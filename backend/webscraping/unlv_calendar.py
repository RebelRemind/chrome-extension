import re
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from database import BASE
from webscraping.building_images import parse_listing_page as parse_building_image_listing

# URL of the UNLV event calendar
URL = "https://www.unlv.edu/calendar"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}

INTERESTS = [
    "Arts",
    "Academics",
    "Career",
    "Culture",
    "Diversity",
    "Health",
    "Social",
    "Sports",
    "Tech",
    "Community",
]

CATEGORY_KEYWORDS = {
    "Arts": {
        "art", "arts", "artist", "gallery", "exhibit", "exhibition", "museum",
        "music", "concert", "band", "orchestra", "choir", "theater", "theatre",
        "film", "cinema", "screening", "dance", "poetry", "creative", "design",
        "fashion", "performance", "visual", "craft", "jazz", "broadcast", "radio",
        "podcasting", "podcast", "recording", "editing", "audio", "recital",
        "guitar", "mic",
    },
    "Academics": {
        "academic", "academics", "class", "classes", "course", "courses", "study",
        "studies", "research", "lecture", "seminar", "symposium", "colloquium",
        "workshop", "lab", "exam", "midterm", "finals", "orientation",
        "advising", "tutoring", "curriculum", "faculty", "scholar", "learning",
        "dissertation", "thesis", "defense", "defenses", "presentation",
        "presentations", "library", "student", "graduate", "grad", "literacy",
        "teaching", "webcampus", "gis", "geographic", "information", "systems",
        "bootcamp", "training", "doctor", "doctoral", "policy", "bsn", "nursing",
        "licensure", "proposal", "proposals", "publishing", "publish", "tenure",
        "promotion", "forum", "summit", "education", "mentor", "mentoring",
        "proseminar", "anthropology", "open", "house",
    },
    "Career": {
        "career", "careers", "resume", "interview", "networking", "employer",
        "internship", "internships", "job", "jobs", "hiring", "recruiting",
        "recruitment", "professional", "professionals", "leadership",
        "entrepreneur", "entrepreneurship", "linkedin", "business", "workforce",
        "readiness", "representative", "visit", "postgraduate", "post-graduate",
        "finance", "financial", "aid", "tax", "retire", "retirement", "withholding",
        "application", "applying",
    },
    "Culture": {
        "culture", "cultural", "heritage", "language", "tradition", "traditions",
        "global", "international", "multicultural", "festival", "celebration",
        "history", "diaspora", "filipino", "chinese", "medicine", "lunar",
        "medieval", "market", "newman",
    },
    "Diversity": {
        "diversity", "equity", "inclusion", "inclusive", "belonging", "identity",
        "identities", "justice", "advocacy", "allyship", "intersectionality",
        "women", "latinx", "hispanic", "black", "asian", "pacific", "indigenous",
        "lgbt", "lgbtq", "pride", "disability", "accessibility", "queer",
        "veteran", "veterans", "generation", "first-generation", "urm",
        "sorority", "fraternity",
    },
    "Health": {
        "health", "wellness", "mental", "mindfulness", "fitness", "exercise",
        "workout", "nutrition", "therapy", "counseling", "self-care", "yoga",
        "meditation", "medical", "clinic", "stress", "recovery", "sleep",
        "blood", "cpr", "aed", "first", "aid", "grounding", "centering",
        "breath", "care", "pilates", "adaptive", "perfectionist", "anxiety",
        "depression", "aromatherapy", "eating", "narcan", "calm", "mood",
        "boosting", "coping",
    },
    "Social": {
        "social", "mixer", "meetup", "hangout", "party", "celebration", "game",
        "games", "trivia", "movie", "welcome", "friendship", "fun", "fest",
        "reception", "picnic", "bingo", "bites", "coffee", "appreciation",
        "member", "members", "meeting", "meetings", "hour", "meet", "greet",
        "dinner", "night", "dark", "fair", "kick", "kickoff", "crafting",
        "jeopardy", "market", "book", "yarn",
    },
    "Sports": {
        "sport", "sports", "athletic", "athletics", "game", "games", "match",
        "tournament", "playoff", "practice", "baseball", "basketball", "football",
        "soccer", "softball", "tennis", "golf", "volleyball", "swimming",
        "diving", "track", "cross", "run", "running", "rebel", "swim",
        "bike", "bikes", "scooter", "paddleboard", "snowshoe", "trek",
        "dogs", "desert", "range", "shoot", "pool",
    },
    "Tech": {
        "tech", "technology", "coding", "code", "programming", "developer",
        "development", "software", "hardware", "ai", "robotics", "cyber",
        "cybersecurity", "data", "engineering", "computer", "computing", "hack",
        "hackathon", "stem", "machine", "science", "webcampus", "gis",
        "podcasting", "audio", "recording", "editing",
    },
    "Community": {
        "community", "service", "volunteer", "volunteering", "outreach", "cleanup",
        "donation", "fundraiser", "charity", "support", "neighbors", "civic",
        "engagement", "drive", "food", "pantry", "prep", "tax", "burrowing",
        "owl", "clean", "up",
    },
}

PHRASE_BONUSES = {
    "Arts": ("art show", "live music", "film screening", "poetry slam"),
    "Academics": (
        "research symposium", "study session", "academic advising",
        "dissertation defense", "thesis defense", "study night", "online classes",
        "teaching at unlv", "webcampus", "information session", "gis bootcamp",
        "geographic information systems", "chemical hygiene", "laboratory safety",
        "success series", "writing essentials", "faculty awards",
    ),
    "Career": (
        "career fair", "resume workshop", "mock interview", "job fair",
        "employer visit", "post graduate careers", "financial aid",
        "tax prep", "retirement", "w-4", "corporate challenge",
    ),
    "Culture": (
        "cultural festival", "heritage month", "international night",
        "traditional chinese medicine", "global success series",
        "lunar new year", "night market", "medieval feast",
    ),
    "Diversity": (
        "diversity dialogue", "equity summit", "pride week", "queer mini con",
        "first generation", "fraternity sorority life", "good trouble",
    ),
    "Health": (
        "mental health", "wellness week", "self care", "fitness class",
        "blood drive", "guided meditation", "first aid certification",
        "adaptive perfectionist", "family swim", "grounding and centering",
        "intuitive eating", "coping with anxiety", "mood boosting", "pilates",
    ),
    "Social": (
        "game night", "welcome week", "ice cream", "movie night",
        "happy hour", "grad fest", "general member meetings", "bingo bites",
        "meet and greet", "mid week dinner", "campus kick off", "rebels after dark",
        "open mic", "blind date with a book",
    ),
    "Sports": (
        "basketball game", "football game", "soccer match", "family swim",
        "learn to stand up paddleboard", "snowshoe", "bike and scooter", "desert dogs",
    ),
    "Tech": (
        "career in tech", "data science", "computer science", "artificial intelligence",
        "podcasting 101", "podcasting 102", "audio mixing",
    ),
    "Community": (
        "community service", "food drive", "service day", "volunteer day",
        "tax prep", "clean up",
    ),
}

PAST_MONTH_WINDOW_DAYS = 90
FUTURE_WEEK_BUFFER = 1
DETAIL_FETCH_WORKERS = 8
BUILDINGS_URL = "https://www.unlv.edu/maps/buildings"
DEFAULT_EVENT_IMAGE_URL = "/images/UNLV_Logo.png"

# UNLV event pages sometimes use familiar facility abbreviations rather than the
# map directory's official building code/name. SRWC refers to RWC: Student
# Recreation & Wellness Center.
BUILDING_LOCATION_ALIASES = {
    "srwc": "rwc",
}


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
    try:
        response = requests.get(BUILDINGS_URL, headers=USER_AGENT, timeout=20)
        response.raise_for_status()
    except requests.RequestException:
        return {}

    return build_building_image_lookup(parse_building_image_listing(response.text))


def fetch_event_details(link, building_image_lookup=None):
    if not link:
        return {}

    try:
        response = requests.get(link, headers=USER_AGENT, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        return {}

    soup = BeautifulSoup(response.text, "html.parser")
    event_details = {}

    image_url = extract_event_image_url(soup)
    if image_url:
        event_details["imageUrl"] = image_url

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

    when_text = read_heading_value(soup, "When")
    if not when_text:
        return event_details

    parts = [segment.strip() for segment in when_text.split(" to ", 1)]
    if len(parts) != 2:
        return event_details

    start_time = parse_unlv_detail_time(parts[0])
    end_time = parse_unlv_detail_time(parts[1])
    if not end_time:
        return event_details

    event_details.update({
        "startTime": start_time,
        "endTime": end_time,
    })
    return event_details


def normalize_text(text):
    return re.sub(r"[^a-z0-9\s]+", " ", (text or "").lower()).strip()


def categorize_event(event_name, event_description=""):
    normalized_name = normalize_text(event_name)
    normalized_description = normalize_text(event_description)
    combined_text = " ".join(part for part in [normalized_name, normalized_description] if part).strip()

    if not combined_text:
        return None

    tokens = set(combined_text.split())
    category_scores = {category: 0 for category in INTERESTS}

    for category, keywords in CATEGORY_KEYWORDS.items():
        matches = tokens.intersection(keywords)
        category_scores[category] += len(matches)

    for category, phrases in PHRASE_BONUSES.items():
        for phrase in phrases:
            if phrase in combined_text:
                category_scores[category] += 2

    best_category = max(category_scores, key=category_scores.get)
    if category_scores[best_category] == 0:
        return None
    return best_category


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
    while week_start <= end_week:
        yield build_week_url(week_start)
        week_start += timedelta(weeks=1)


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
            "category": categorize_event(title, ""),
            "link": link,
            "imageUrl": DEFAULT_EVENT_IMAGE_URL,
        }
        events.append(event_data)

    return events


def enrich_event_details(events):
    linked_events = []
    for event in events:
        if not event.get("link"):
            continue
        linked_events.append(event)

    if not linked_events:
        return events

    building_image_lookup = fetch_building_images()
    future_to_event = {}
    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        for event in linked_events:
            future = executor.submit(fetch_event_details, event["link"], building_image_lookup)
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
            if detail_time_data.get("description"):
                event["description"] = detail_time_data["description"]
            if detail_time_data.get("imageUrl"):
                event["imageUrl"] = detail_time_data["imageUrl"]

            event["category"] = categorize_event(event.get("name", ""), event.get("description", ""))

    return events


def scrape():
    all_events = []
    seen = set()

    for week_url in iter_week_urls():
        response = requests.get(week_url, headers=USER_AGENT, timeout=15)
        if response.status_code != 200:
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        for event in enrich_event_details(parse_events_from_soup(soup)):
            dedupe_key = (event["name"], event["startDate"], event["startTime"], event["location"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            all_events.append(event)

    return all_events

def default():
    results = scrape()
    # PUT events into database
    for event in results:
        requests.put(BASE + "unlvcalendar_add", json=event)

if __name__ == "__main__":
    default()
