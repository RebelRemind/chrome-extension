import re
import time
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from database import BASE
from webscraping.building_images import parse_listing_page as parse_building_image_listing
from webscraping.categorize_unlv_calendar import categorize_event as categorize_unlv_calendar_event

# URL of the UNLV event calendar
URL = "https://www.unlv.edu/calendar"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}

PAST_MONTH_WINDOW_DAYS = 90
FUTURE_WEEK_BUFFER = 1
DETAIL_FETCH_WORKERS = 4
DETAIL_FETCH_ATTEMPTS = 2
DETAIL_FETCH_TIMEOUT_SECONDS = 20
BUILDINGS_URL = "https://www.unlv.edu/maps/buildings"
DEFAULT_EVENT_IMAGE_URL = "/images/UNLV_Logo.png"
DETAIL_TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)"
    r"\s*(?:to|-|\u2013|\u2014)\s*"
    r"(?P<end>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)",
    re.I,
)

# UNLV event pages sometimes use familiar facility abbreviations rather than the
# map directory's official building code/name. SRWC refers to RWC: Student
# Recreation & Wellness Center.
BUILDING_LOCATION_ALIASES = {
    "srwc": "rwc",
}


def log_scraper(message, **fields):
    details = " ".join(f"{key}={value}" for key, value in fields.items())
    suffix = f" {details}" if details else ""
    print(f"[unlv-calendar] {message}{suffix}", flush=True)


def normalize_time_label(raw_time):
    value = " ".join((raw_time or "").split())
    if not value or value.upper() in {"NO TIME", "TBA", "TIME TBD"}:
        return ""
    if "ALL DAY" in value.upper():
        return "(ALL DAY)"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)", value, re.I)
    if not match:
        return value

    hour = int(match.group(1))
    minute = match.group(2) or "00"
    meridiem = match.group(3).upper()
    return f"{hour}:{minute} {meridiem}"


def parse_unlv_detail_time(value):
    cleaned = " ".join((value or "").replace(".", "").split())
    if not cleaned:
        return ""

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*([ap]m)", cleaned, re.I)
    if not match:
        return ""

    hour = int(match.group(1))
    minute = match.group(2) or "00"
    meridiem = match.group(3).upper()
    return f"{hour}:{minute} {meridiem}"


def parse_unlv_detail_time_range(value):
    match = DETAIL_TIME_RANGE_RE.search(" ".join((value or "").split()))
    if not match:
        return "", ""

    return (
        parse_unlv_detail_time(match.group("start")),
        parse_unlv_detail_time(match.group("end")),
    )


def canonical_event_link(link):
    return (link or "").split("?", 1)[0]


def parse_listing_date(value):
    try:
        return datetime.strptime(value, "%A, %B %d, %Y").date()
    except (TypeError, ValueError):
        return date.max


def event_sort_key(event):
    return (
        parse_listing_date(event.get("startDate", "")),
        normalize_time_label(event.get("startTime", "")),
        event.get("name", ""),
    )


def read_heading_value(soup, heading_label):
    heading = soup.find(
        lambda tag: tag.name in {"h2", "h3", "h4"}
        and tag.get_text(" ", strip=True) == heading_label
    )
    if heading is None:
        return ""

    value_parts = []
    sibling = heading.find_next_sibling()
    while sibling is not None:
        if sibling.name in {"h2", "h3", "h4"}:
            break
        text = sibling.get_text(" ", strip=True)
        if text:
            value_parts.append(text)
        sibling = sibling.find_next_sibling()

    return " ".join(value_parts)


def extract_event_image_url(soup):
    image_meta = (
        soup.find("meta", property="og:image")
        or soup.find("meta", attrs={"name": "twitter:image"})
    )
    image_url = image_meta.get("content", "").strip() if image_meta else ""
    if image_url:
        return urljoin("https://www.unlv.edu", image_url)

    image_node = soup.select_one(".field--name-field-image img[src], article img[src]")
    if image_node:
        return urljoin("https://www.unlv.edu", image_node.get("src", "").strip())

    return ""


def normalize_location_name(value):
    normalized = re.sub(r"[^a-z0-9\s]+", " ", (value or "").lower())
    normalized = re.sub(r"\b(building|hall|center|the|room|rm)\b", " ", normalized)
    return " ".join(normalized.split())


def build_building_image_lookup(items):
    lookup = {}
    for item in items:
        image_link = item.get("image-link", "")
        if not image_link:
            continue

        for value in (item.get("bldg-name", ""), item.get("bldg-code", "")):
            key = normalize_location_name(value)
            if key:
                lookup[key] = image_link

    return lookup


def resolve_building_image(location, building_image_lookup):
    location_key = normalize_location_name(location)
    if not location_key:
        return ""

    location_key = BUILDING_LOCATION_ALIASES.get(location_key, location_key)

    if location_key in building_image_lookup:
        return building_image_lookup[location_key]

    for key, image_link in building_image_lookup.items():
        if len(key) >= 3 and (key in location_key or location_key in key):
            return image_link

    return ""


def fetch_building_images():
    started_at = time.monotonic()
    try:
        response = requests.get(BUILDINGS_URL, headers=USER_AGENT, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        log_scraper(
            "building_images_failed",
            elapsed=f"{time.monotonic() - started_at:.2f}s",
            error=type(exc).__name__,
        )
        return {}

    lookup = build_building_image_lookup(parse_building_image_listing(response.text))
    log_scraper(
        "building_images_loaded",
        elapsed=f"{time.monotonic() - started_at:.2f}s",
        entries=len(lookup),
    )
    return lookup


def fetch_event_details(link, building_image_lookup=None):
    if not link:
        return {}

    soup = None
    for attempt in range(1, DETAIL_FETCH_ATTEMPTS + 1):
        started_at = time.monotonic()
        try:
            response = requests.get(link, headers=USER_AGENT, timeout=DETAIL_FETCH_TIMEOUT_SECONDS)
            response.raise_for_status()
        except requests.RequestException as exc:
            log_scraper(
                "detail_fetch_failed",
                attempt=attempt,
                elapsed=f"{time.monotonic() - started_at:.2f}s",
                error=type(exc).__name__,
                link=link,
            )
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        break

    if soup is None:
        log_scraper("detail_fetch_gave_up", attempts=DETAIL_FETCH_ATTEMPTS, link=link)
        return {}

    event_details = {}
    image_source = ""

    image_url = extract_event_image_url(soup)
    if image_url:
        event_details["imageUrl"] = image_url
        image_source = "event_page"

    meta_description = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    description = meta_description.get("content", "").strip() if meta_description else ""
    if description:
        event_details["description"] = description

    campus_location = read_heading_value(soup, "Campus Location")
    if campus_location:
        event_details["campusLocation"] = campus_location
        if not image_url:
            building_image = resolve_building_image(campus_location, building_image_lookup or {})
            if building_image:
                event_details["imageUrl"] = building_image
                image_source = "building"

    if image_source:
        event_details["_imageSource"] = image_source

    when_text = read_heading_value(soup, "When")
    if not when_text:
        return event_details

    start_time, end_time = parse_unlv_detail_time_range(when_text)
    if not end_time:
        return event_details

    event_details.update({
        "startTime": start_time,
        "endTime": end_time,
    })
    return event_details


def fetch_event_details_for_group(events, building_image_lookup=None):
    for event in events[:3]:
        event_details = fetch_event_details(event.get("link", ""), building_image_lookup)
        if event_details.get("description") or event_details.get("imageUrl") or event_details.get("endTime"):
            return event_details

    return {}


def categorize_event(event_or_name, event_description="", event_location=""):
    if isinstance(event_or_name, dict):
        category, _reasons = categorize_unlv_calendar_event(event_or_name)
        return category

    category, _reasons = categorize_unlv_calendar_event({
        "name": event_or_name,
        "description": event_description,
        "location": event_location,
    })
    return category


def build_week_url(target_date):
    iso_year, iso_week, _ = target_date.isocalendar()
    return f"{URL}/{iso_year}-W{iso_week:02d}"


def iter_week_urls():
    today = date.today()
    cutoff = today - timedelta(days=PAST_MONTH_WINDOW_DAYS)
    current_week_start = today - timedelta(days=today.weekday())
    start_week = cutoff - timedelta(days=cutoff.weekday())
    end_week = current_week_start + timedelta(weeks=FUTURE_WEEK_BUFFER)

    week_start = start_week
    current_and_future_weeks = []
    recent_past_weeks = []
    while week_start <= end_week:
        if week_start >= current_week_start:
            current_and_future_weeks.append(week_start)
        else:
            recent_past_weeks.append(week_start)
        week_start += timedelta(weeks=1)

    for week_start in current_and_future_weeks:
        yield build_week_url(week_start)

    for week_start in reversed(recent_past_weeks):
        yield build_week_url(week_start)


def parse_events_from_soup(soup):
    events = []
    seen = set()

    # Loop through each event on the page
    for event in soup.find_all("div", class_="col-sm-10"):
        title_elem = event.find("a")
        title = title_elem.text.strip() if title_elem else "No Title"
        link = "https://www.unlv.edu" + title_elem["href"] if title_elem else "No Link"

        time_elem = event.find_next_sibling("div", class_="col-sm-2")
        time = time_elem.text.strip() if time_elem else "No Time"

        location_elem = event.find_next_sibling("div", class_="col-sm-12 text-sm")
        location = location_elem.text.strip() if location_elem else "No Location"
        date_elem = event.find_previous("div", class_="card-header")
        event_date = date_elem.text.strip() if date_elem else "TBD"

        dedupe_key = (title, event_date, time, location)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        normalized_list_time = normalize_time_label(time)

        event_data = {
            "name": title,
            "startDate": event_date,
            "startTime": normalized_list_time,
            "endDate": event_date,
            "endTime": "",
            "location": location,
            "description": "",
            "link": link,
            "imageUrl": DEFAULT_EVENT_IMAGE_URL,
        }
        event_data["category"] = categorize_event(event_data)
        events.append(event_data)

    return events


def enrich_event_details(events):
    events_by_link = {}
    for event in events:
        if not event.get("link"):
            continue
        events_by_link.setdefault(canonical_event_link(event["link"]), []).append(event)

    if not events_by_link:
        return events

    started_at = time.monotonic()
    building_image_lookup = fetch_building_images()
    log_scraper(
        "detail_enrichment_started",
        events=len(events),
        detail_groups=len(events_by_link),
        workers=DETAIL_FETCH_WORKERS,
    )
    future_to_event = {}
    stats = {
        "processed": 0,
        "description": 0,
        "event_page_image": 0,
        "building_image": 0,
        "default_logo": 0,
        "empty_detail": 0,
    }
    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        for linked_events in events_by_link.values():
            event = linked_events[0]
            future = executor.submit(fetch_event_details_for_group, linked_events, building_image_lookup)
            future_to_event[future] = event

        for future in as_completed(future_to_event):
            event = future_to_event[future]
            linked_events = events_by_link.get(canonical_event_link(event.get("link", "")), [event])
            try:
                detail_time_data = future.result()
            except Exception as exc:
                log_scraper(
                    "detail_group_failed",
                    error=type(exc).__name__,
                    link=event.get("link", ""),
                )
                detail_time_data = {}

            stats["processed"] += 1
            if not detail_time_data:
                stats["empty_detail"] += 1
            if detail_time_data.get("description"):
                stats["description"] += len(linked_events)
            if detail_time_data.get("_imageSource") == "event_page":
                stats["event_page_image"] += len(linked_events)
            elif detail_time_data.get("_imageSource") == "building":
                stats["building_image"] += len(linked_events)
            else:
                stats["default_logo"] += len(linked_events)

            for linked_event in linked_events:
                if detail_time_data.get("startTime"):
                    linked_event["startTime"] = detail_time_data["startTime"]
                if detail_time_data.get("endTime"):
                    linked_event["endTime"] = detail_time_data["endTime"]
                if detail_time_data.get("description"):
                    linked_event["description"] = detail_time_data["description"]
                if detail_time_data.get("imageUrl"):
                    linked_event["imageUrl"] = detail_time_data["imageUrl"]
                if detail_time_data.get("_imageSource"):
                    linked_event["_imageSource"] = detail_time_data["_imageSource"]

                linked_event["category"] = categorize_event(linked_event)

            if stats["processed"] % 50 == 0 or stats["processed"] == len(events_by_link):
                log_scraper(
                    "detail_enrichment_progress",
                    processed=f"{stats['processed']}/{len(events_by_link)}",
                    elapsed=f"{time.monotonic() - started_at:.2f}s",
                    descriptions=stats["description"],
                    event_page_images=stats["event_page_image"],
                    building_images=stats["building_image"],
                    default_logos=stats["default_logo"],
                    empty_details=stats["empty_detail"],
                )

    log_scraper(
        "detail_enrichment_finished",
        elapsed=f"{time.monotonic() - started_at:.2f}s",
        descriptions=stats["description"],
        event_page_images=stats["event_page_image"],
        building_images=stats["building_image"],
        default_logos=stats["default_logo"],
        empty_details=stats["empty_detail"],
    )
    return events


def scrape():
    started_at = time.monotonic()
    all_events = []
    seen = set()
    week_urls = list(iter_week_urls())
    log_scraper("scrape_started", weeks=len(week_urls), workers=DETAIL_FETCH_WORKERS)

    for index, week_url in enumerate(week_urls, start=1):
        week_started_at = time.monotonic()
        try:
            response = requests.get(week_url, headers=USER_AGENT, timeout=15)
        except requests.RequestException as exc:
            log_scraper(
                "week_fetch_failed",
                week=f"{index}/{len(week_urls)}",
                elapsed=f"{time.monotonic() - week_started_at:.2f}s",
                error=type(exc).__name__,
                url=week_url,
            )
            continue

        if response.status_code != 200:
            log_scraper(
                "week_fetch_skipped",
                week=f"{index}/{len(week_urls)}",
                elapsed=f"{time.monotonic() - week_started_at:.2f}s",
                status=response.status_code,
                url=week_url,
            )
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        parsed_events = parse_events_from_soup(soup)
        added_count = 0
        for event in parsed_events:
            dedupe_key = (event["name"], event["startDate"], event["startTime"], event["location"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            all_events.append(event)
            added_count += 1

        log_scraper(
            "week_fetch_finished",
            week=f"{index}/{len(week_urls)}",
            elapsed=f"{time.monotonic() - week_started_at:.2f}s",
            parsed=len(parsed_events),
            added=added_count,
            total=len(all_events),
            url=week_url,
        )

    enriched_events = sorted(enrich_event_details(all_events), key=event_sort_key)
    event_page_image_count = sum(1 for event in enriched_events if event.get("_imageSource") == "event_page")
    building_image_count = sum(1 for event in enriched_events if event.get("_imageSource") == "building")
    log_scraper(
        "scrape_finished",
        elapsed=f"{time.monotonic() - started_at:.2f}s",
        events=len(enriched_events),
        descriptions=sum(1 for event in enriched_events if event.get("description")),
        event_page_images=event_page_image_count,
        building_images=building_image_count,
        default_logos=sum(1 for event in enriched_events if event.get("imageUrl") == DEFAULT_EVENT_IMAGE_URL),
    )
    for event in enriched_events:
        event.pop("_imageSource", None)
    return enriched_events

def default():
    results = scrape()
    # PUT events into database
    for event in results:
        requests.put(BASE + "unlvcalendar_add", json=event)

if __name__ == "__main__":
    default()
