import re
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup

from database import BASE

BASE_URL = "https://unlvrebels.com"
SPORT_SCHEDULES = {
    "Baseball": f"{BASE_URL}/sports/baseball/schedule",
    "Football": f"{BASE_URL}/sports/football/schedule",
    "Softball": f"{BASE_URL}/sports/softball/schedule",
    "Swimming & Diving": f"{BASE_URL}/sports/swimming-and-diving/schedule",
    "Men's Basketball": f"{BASE_URL}/sports/mens-basketball/schedule",
    "Men's Golf": f"{BASE_URL}/sports/mens-golf/schedule",
    "Men's Soccer": f"{BASE_URL}/sports/mens-soccer/schedule",
    "Men's Tennis": f"{BASE_URL}/sports/mens-tennis/schedule",
    "Women's Basketball": f"{BASE_URL}/sports/womens-basketball/schedule",
    "Women's Cross Country": f"{BASE_URL}/sports/womens-cross-country/schedule",
    "Women's Golf": f"{BASE_URL}/sports/womens-golf/schedule",
    "Women's Soccer": f"{BASE_URL}/sports/womens-soccer/schedule",
    "Women's Tennis": f"{BASE_URL}/sports/womens-tennis/schedule",
    "Women's Track & Field": f"{BASE_URL}/sports/womens-track-and-field/schedule",
    "Women's Volleyball": f"{BASE_URL}/sports/womens-volleyball/schedule",
}
PAST_MONTH_WINDOW_DAYS = 90
USER_AGENT = {"User-Agent": "Mozilla/5.0"}
DETAIL_FETCH_WORKERS = 8


def infer_year(month_day_text):
    clean = " ".join(month_day_text.split())
    today = date.today()
    candidates = []

    for candidate_year in (today.year - 1, today.year, today.year + 1):
        try:
            candidate_date = datetime.strptime(f"{clean} {candidate_year}", "%b %d %Y").date()
        except ValueError:
            continue
        candidates.append(candidate_date)

    if not candidates:
        return None

    return min(candidates, key=lambda candidate: abs((candidate - today).days))


def normalize_time_label(raw_time):
    value = " ".join((raw_time or "").split())
    if not value:
        return "(ALL DAY)"

    upper = value.upper()
    if upper in {"TBA", "TIME TBD", "NO TIME"}:
        return ""
    if "ALL DAY" in upper:
        return "(ALL DAY)"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)", value, re.I)
    if not match:
        return ""

    hour = int(match.group(1))
    minute = match.group(2) or "00"
    meridiem = match.group(3).upper()
    return f"{hour}:{minute} {meridiem}"


def parse_time_label(raw_time):
    normalized = normalize_time_label(raw_time)
    if not normalized or normalized == "(ALL DAY)":
        return None

    try:
        return datetime.strptime(normalized, "%I:%M %p")
    except ValueError:
        return None


def format_time_label(dt_value):
    if dt_value is None:
        return ""
    return dt_value.strftime("%I:%M %p").lstrip("0")


def extract_preferred_link(item):
    links = item.select(".sidearm-schedule-game-links a[href]")
    if not links:
        return ""

    best_link = ""
    for link in links:
        href = (link.get("href") or "").strip()
        label = link.get_text(" ", strip=True).lower()
        href_lower = href.lower()
        if any(token in href_lower for token in ("/boxscore", "boxscore.aspx", "/stats/")) or "box score" in label:
            best_link = href
            break
        if not best_link:
            best_link = href

    if not best_link:
        return ""
    if best_link.startswith("/"):
        return f"{BASE_URL}{best_link}"
    return best_link


def compute_end_time_from_duration(start_time, duration_text):
    start_dt = parse_time_label(start_time)
    duration_match = re.fullmatch(r"(\d{1,2}):(\d{2})", (duration_text or "").strip())
    if start_dt is None or duration_match is None:
        return ""

    hours = int(duration_match.group(1))
    minutes = int(duration_match.group(2))
    return format_time_label(start_dt + timedelta(hours=hours, minutes=minutes))


def fetch_event_time_range(link, start_time):
    if not link:
        return {}

    try:
        response = requests.get(link, headers=USER_AGENT, timeout=15)
        response.raise_for_status()
    except requests.RequestException:
        return {}

    page_text = BeautifulSoup(response.text, "html.parser").get_text("\n", strip=True)

    explicit_end_match = re.search(
        r"End of Game:\s*([0-9]{1,2}(?::[0-9]{2})?\s*[AP]M)",
        page_text,
        re.I,
    )
    if explicit_end_match:
        return {"endTime": normalize_time_label(explicit_end_match.group(1))}

    start_duration_match = re.search(
        r"Start\s*([0-9]{1,2}(?::[0-9]{2})?\s*[AP]M)\s*Time\s*([0-9]{1,2}:[0-9]{2})",
        page_text,
        re.I,
    )
    if start_duration_match:
        derived_end_time = compute_end_time_from_duration(
            start_duration_match.group(1),
            start_duration_match.group(2),
        )
        if derived_end_time:
            return {
                "startTime": normalize_time_label(start_duration_match.group(1)),
                "endTime": derived_end_time,
            }

    duration_match = re.search(r"Duration:\s*([0-9]{1,2}:[0-9]{2})", page_text, re.I)
    if duration_match:
        derived_end_time = compute_end_time_from_duration(start_time, duration_match.group(1))
        if derived_end_time:
            return {"endTime": derived_end_time}

    return {}


def enrich_event_times(events):
    timed_events = []
    for event in events:
        if event.get("link") and event.get("startTime"):
            timed_events.append(event)

    if not timed_events:
        return events

    future_to_event = {}
    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        for event in timed_events:
            future = executor.submit(
                fetch_event_time_range,
                event["link"],
                event.get("startTime", ""),
            )
            future_to_event[future] = event

        for future in as_completed(future_to_event):
            event = future_to_event[future]
            try:
                detail_time_data = future.result()
            except Exception:
                detail_time_data = {}

            if detail_time_data.get("startTime"):
                event["startTime"] = detail_time_data["startTime"]
            if detail_time_data.get("endTime"):
                event["endTime"] = detail_time_data["endTime"]

    return events


def parse_schedule_item(item, sport):
    date_block = item.select_one(".sidearm-schedule-game-opponent-date")
    opponent_name = item.select_one(".sidearm-schedule-game-opponent-name")
    location = item.select_one(".sidearm-schedule-game-location")
    event_link = extract_preferred_link(item)

    if date_block is None or opponent_name is None:
        return None

    date_text = " ".join(date_block.get_text(" ", strip=True).split())
    match = re.search(r"([A-Z][a-z]{2}) (\d{1,2}) \([A-Za-z]{3}\)(.*)", date_text)
    if not match:
        return None

    month_day = f"{match.group(1)} {match.group(2)}"
    event_date = infer_year(month_day)
    if event_date is None:
        return None

    time_text = normalize_time_label(match.group(3))

    return {
        "name": opponent_name.get_text(" ", strip=True),
        "startDate": event_date.strftime("%m/%d/%Y"),
        "startTime": time_text,
        "endDate": event_date.strftime("%m/%d/%Y"),
        "endTime": "",
        "sport": sport,
        "link": event_link,
        "location": location.get_text(" ", strip=True) if location else "",
    }


def within_window(event):
    event_date = datetime.strptime(event["startDate"], "%m/%d/%Y").date()
    cutoff = date.today() - timedelta(days=PAST_MONTH_WINDOW_DAYS)
    return event_date >= cutoff


def scrape_schedule_page(sport, url):
    response = requests.get(url, headers=USER_AGENT, timeout=15)
    if response.status_code != 200:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    results = []
    seen = set()

    for item in soup.select("li.sidearm-schedule-game"):
        event = parse_schedule_item(item, sport)
        if event is None or not within_window(event):
            continue

        dedupe_key = (event["name"], event["startDate"], event["startTime"], sport)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        results.append(event)

    return enrich_event_times(results)


def scrape():
    all_events = []
    for sport, url in SPORT_SCHEDULES.items():
        all_events.extend(scrape_schedule_page(sport, url))

    all_events.sort(
        key=lambda event: (
            datetime.strptime(event["startDate"], "%m/%d/%Y"),
            event["startTime"],
            event["name"],
        )
    )
    return all_events


def default():
    results = scrape()
    for event in results:
        requests.put(BASE + "rebelcoverage_add", json=event)


if __name__ == '__main__':
    default()
