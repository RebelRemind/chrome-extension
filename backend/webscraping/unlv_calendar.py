import re

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


def scrape():
    # Make request inside function
    response = requests.get(URL, headers={"User-Agent": "Mozilla/5.0"})
    index = 0
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "html.parser")
        
        events = []  # Initialize an empty list to hold events

        # Loop through each event on the page
        for event in soup.find_all("div", class_="col-sm-10"):
            title_elem = event.find("a")
            title = title_elem.text.strip() if title_elem else "No Title"
            link = "https://www.unlv.edu" + title_elem["href"] if title_elem else "No Link"

            time_elem = event.find_next_sibling("div", class_="col-sm-2")
            time = time_elem.text.strip() if time_elem else "No Time"

            location_elem = event.find_next_sibling("div", class_="col-sm-12 text-sm")
            location = location_elem.text.strip() if location_elem else "No Location"
            # Extract date 
            date_elem = event.find_previous("div", class_="card-header")
            date = date_elem.text.strip() if date_elem else "TBD"
           
            # Prepare event data to send to the Flask API
            event_data = {
                "name": title,
                "startDate": date,  
                "startTime": time,
                "endDate": date,
                "location": location,
                "category": None,
                "link": link
            }
            category = categorize_event(title)
            event_data["category"] = category
            # Send event data to Flask API
            # api_response = requests.put(BASE + f"unlvcalendar_id/{event_id}", json=event_data)
            # api_response = requests.put(BASE + "unlvcalendar_add", json=event_data)
            # if api_response.status_code == 201:
            #     pass

            events.append(event_data)  # Add event data to the events list
            # index += 1
            # if index == 10:
            #   break
            
        # with open('scraped_UNLVCalendar.json', 'w') as json_file:
        #     json.dump(events, json_file, indent=4)  # Write events as formatted JSON
        return events
    else:
        print(f"Failed to access the page. Status code: {response.status_code}")

def default():
    results = scrape()
    # PUT events into database
    for event in results:
        requests.put(BASE + "unlvcalendar_add", json=event)

if __name__ == "__main__":
    default()
