import re
from datetime import date, datetime, timedelta

import requests
from bs4 import BeautifulSoup
from database import BASE

# URL of the UNLV event calendar
URL = "https://www.unlv.edu/calendar"

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
        "fashion", "performance", "visual", "craft",
    },
    "Academics": {
        "academic", "academics", "class", "classes", "course", "courses", "study",
        "studies", "research", "lecture", "seminar", "symposium", "colloquium",
        "workshop", "lab", "exam", "midterm", "finals", "orientation",
        "advising", "tutoring", "curriculum", "faculty", "scholar", "learning",
        "dissertation", "thesis", "defense", "defenses", "presentation",
        "presentations", "library", "student", "graduate", "grad", "literacy",
    },
    "Career": {
        "career", "careers", "resume", "interview", "networking", "employer",
        "internship", "internships", "job", "jobs", "hiring", "recruiting",
        "recruitment", "professional", "professionals", "leadership",
        "entrepreneur", "entrepreneurship", "linkedin", "business", "workforce",
        "readiness", "representative", "visit", "postgraduate", "post-graduate",
        "finance", "financial", "aid",
    },
    "Culture": {
        "culture", "cultural", "heritage", "language", "tradition", "traditions",
        "global", "international", "multicultural", "festival", "celebration",
        "history", "diaspora", "filipino", "chinese", "medicine",
    },
    "Diversity": {
        "diversity", "equity", "inclusion", "inclusive", "belonging", "identity",
        "identities", "justice", "advocacy", "allyship", "intersectionality",
        "women", "latinx", "hispanic", "black", "asian", "pacific", "indigenous",
        "lgbt", "lgbtq", "pride", "disability", "accessibility", "queer",
        "veteran", "veterans", "generation", "first-generation",
    },
    "Health": {
        "health", "wellness", "mental", "mindfulness", "fitness", "exercise",
        "workout", "nutrition", "therapy", "counseling", "self-care", "yoga",
        "meditation", "medical", "clinic", "stress", "recovery", "sleep",
        "blood", "cpr", "aed", "first", "aid", "grounding", "centering",
        "breath", "care",
    },
    "Social": {
        "social", "mixer", "meetup", "hangout", "party", "celebration", "game",
        "games", "trivia", "movie", "welcome", "friendship", "fun", "fest",
        "reception", "picnic", "bingo", "bites", "coffee", "appreciation",
        "member", "members", "meeting", "meetings", "hour",
    },
    "Sports": {
        "sport", "sports", "athletic", "athletics", "game", "games", "match",
        "tournament", "playoff", "practice", "baseball", "basketball", "football",
        "soccer", "softball", "tennis", "golf", "volleyball", "swimming",
        "diving", "track", "cross", "run", "running", "rebel",
    },
    "Tech": {
        "tech", "technology", "coding", "code", "programming", "developer",
        "development", "software", "hardware", "ai", "robotics", "cyber",
        "cybersecurity", "data", "engineering", "computer", "computing", "hack",
        "hackathon", "stem", "machine", "science",
    },
    "Community": {
        "community", "service", "volunteer", "volunteering", "outreach", "cleanup",
        "donation", "fundraiser", "charity", "support", "neighbors", "civic",
        "engagement", "drive", "food", "pantry",
    },
}

PHRASE_BONUSES = {
    "Arts": ("art show", "live music", "film screening", "poetry slam"),
    "Academics": (
        "research symposium", "study session", "academic advising",
        "dissertation defense", "thesis defense", "study night", "online classes",
    ),
    "Career": (
        "career fair", "resume workshop", "mock interview", "job fair",
        "employer visit", "post graduate careers", "financial aid",
    ),
    "Culture": (
        "cultural festival", "heritage month", "international night",
        "traditional chinese medicine", "global success series",
    ),
    "Diversity": (
        "diversity dialogue", "equity summit", "pride week", "queer mini con",
        "first generation",
    ),
    "Health": (
        "mental health", "wellness week", "self care", "fitness class",
        "blood drive", "guided meditation", "first aid certification",
    ),
    "Social": (
        "game night", "welcome week", "ice cream", "movie night",
        "happy hour", "grad fest", "general member meetings", "bingo bites",
    ),
    "Sports": ("basketball game", "football game", "soccer match"),
    "Tech": ("career in tech", "data science", "computer science", "artificial intelligence"),
    "Community": ("community service", "food drive", "service day", "volunteer day"),
}

PAST_MONTH_WINDOW_DAYS = 90
FUTURE_WEEK_BUFFER = 1


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

def normalize_text(text):
    return re.sub(r"[^a-z0-9\s]+", " ", (text or "").lower()).strip()


def categorize_event(event_name):
    normalized_name = normalize_text(event_name)
    if not normalized_name:
        return None

    tokens = set(normalized_name.split())
    category_scores = {category: 0 for category in INTERESTS}

    for category, keywords in CATEGORY_KEYWORDS.items():
        matches = tokens.intersection(keywords)
        category_scores[category] += len(matches)

    for category, phrases in PHRASE_BONUSES.items():
        for phrase in phrases:
            if phrase in normalized_name:
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

        event_data = {
            "name": title,
            "startDate": event_date,
            "startTime": normalize_time_label(time),
            "endDate": event_date,
            "location": location,
            "category": categorize_event(title),
            "link": link,
        }
        events.append(event_data)

    return events


def scrape():
    all_events = []
    seen = set()

    for week_url in iter_week_urls():
        response = requests.get(week_url, headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code != 200:
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        for event in parse_events_from_soup(soup):
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
