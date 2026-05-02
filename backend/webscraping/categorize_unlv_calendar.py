import re
from collections import defaultdict

INTERESTS = [
    "Arts", "Academics", "Career", "Culture", "Diversity",
    "Health", "Social", "Sports", "Tech", "Community",
]

# Use phrase rules first. These are intentionally specific because many UNLV
# listings contain generic words like workshop, student, lecture, game, support,
# and training that are not reliable by themselves.
PHRASE_RULES = {
    "Community": [
        "service day", "volunteer", "volunteering", "community service", "clean up", "cleanup",
        "food bank", "food pantry", "donation", "donate", "fundraiser", "charity",
        "opportunity village", "project 150", "project marilyn", "three square", "lake mead",
        "urban water conservation", "burrowing owl", "rainbow owl preserve", "cure 4 the kids",
        "community engagement", "community-based", "nonprofit", "civic engagement", "social change",
        "bike and scooter registration", "property registration", "university police department",
    ],
    "Diversity": [
        "diversity", "equity", "inclusion", "belonging", "identity", "identities",
        "black history month", "women's history", "womens history", "pride", "lgbt", "lgbtq",
        "lgbtqia", "queer", "lavender", "latinx", "latino", "latina", "hispanic",
        "asian, pacific islander", "apime", "middle eastern", "native american", "indigenous",
        "first-generation", "first generation", "veteran", "veterans", "disability", "accessibility",
        "undocumented", "monarch celebration", "women's council", "womens council",
        "good trouble", "brown v. board", "lau v. nichols", "plyler v. doe", "hsi resource hub",
        "hispanic-serving", "minority-serving", "decolonizing", "decolonial", "social justice",
    ],
    "Culture": [
        "culture", "cultural", "heritage", "holocaust", "remembrance", "global thursday",
        "language exchange", "conversational chinese", "chinese language", "lunar new year",
        "traditional chinese medicine", "international", "study abroad", "freeman asia", "gilman",
        "diaspora", "filipino", "medieval feast", "newman center", "democracy will win",
        "thomas mann", "salvador", "reclaiming language", "global success series", "culture shock",
    ],
    "Health": [
        "mental health", "wellness", "well-being", "wellbeing", "self-care", "self care",
        "guided meditation", "meditation", "mindful", "mindfulness", "breathing break", "breath",
        "grounding and centering", "gratitude", "guided imagery", "stress", "anxiety", "depression",
        "mood boosting", "recovery", "substance use", "intuitive eating", "nutrition", "sleep",
        "sound bath", "soul movement", "yoga", "pilates", "fitness", "workout", "stretch",
        "functional fitness", "resistance band", "ask the trainer", "adaptive perfectionist",
        "communicating without conflict", "significant other", "therapy", "counseling", "blood drive",
        "blood cancer", "cancer educational", "pre-health", "pre-medicine", "medicine conference",
        "medical education", "clinic", "health sciences", "patient care", "clinical trials",
        "narcan", "cpr", "aed", "first aid", "active assailant",
    ],
    "Sports": [
        "athletics", "unlv athletics", "basketball", "football", "baseball", "softball", "soccer",
        "tennis", "golf", "volleyball", "swimming", "diving", "track and field", "cross country",
        "desert dogs", "lacrosse", "pool party", "triathlon", "sport tuesday",
        "outdoor adventures", "snowshoe", "trek", "hike", "hiking", "hot springs", "paddleboard",
        "bike tuning", "abc's of bikes", "jiu jitsu", "self-defense", "self defense",
        "family swim", "corporate challenge", "badminton", "bowling", "axe throwing", "dodgeball", "racquetball", "8 ball", "b-pong", "bpong",
    ],
    "Career": [
        "career", "careers", "career fair", "career expo", "career kick-off", "career kickoff",
        "resume", "résumé", "interview", "mock interview", "job", "jobs", "employer", "employers",
        "internship", "internships", "hiring", "recruit", "networking", "professional development",
        "translatable skills", "transferable skills", "workforce", "linkedin", "handshake", "vmock",
        "job search", "grad school", "graduate school", "application webinar",
        "financial aid", "scholarship", "scholarships",
        "pre-law", "pre law", "pre-health", "pre health", "pre-medicine", "pre medicine",
        "corporate wardrobe", "communication skills", "tiaa representative", "financial consultant", "retirement", "benefits orientation", "new employee",
        "employee benefits", "visiting professor application", "peer mentor", "mentor experience",
    ],
    "Tech": [
        "ai 101", "artificial intelligence", "ai literacy", "chatgpt", "notebooklm", "machine learning",
        "data science", "data collection", "data management", "data visualization", "nlp", "natural language processing",
        "coding", "programming", "software", "developer", "computer science", "cybersecurity", "cyber",
        "robotics", "stem", "webcampus", "proquest ai",
        "ai research assistant", "podcasting", "recording and editing", "audio production", "video production studio",
        "video studio orientation", "makerspace orientation", 
        "senior design competition", "senior design awards", "technology found inside",
    ],
    "Arts": [
        "art", "arts", "artist", "artivism", "gallery", "exhibit", "exhibition", "museum",
        "music", "concert", "orchestra", "choir", "choral", "band", "chamber music", "symphony",
        "jazz", "guitar", "piano", "recital", "opera", "theater", "theatre", "film", "cinema",
        "dance", "dancing", "poetry", "poem", "creative writing", "open mic",
        "craft", "crafting", "crochet", "knitting", "yarn", "embroidery", "vision board", "calligraphy",
        "wardrobe", "fashion", "performance", "performing", "broadcast", "live broadcast",
        "black mountain institute", "bmi live", "shop talk", "vibes and verse", "arabesque",
        "nevada conservatory theatre", "unlv dance", "montreal guitar trio", "nextet", "all-state",
        "all state", "choirs", "orchestras", "bands", "elementary choral",
    ],
    "Social": [
        "social", "mixer", "meetup", "meet-up", "meet up", "general member meeting", "general meeting",
        "kickoff", "kick-off", "welcome", "game time", "game night", "cards, consoles", "gaming meet-up",
        "trivia", "bingo", "movie night", "late night breakfast", "breakfast", "dinner", "mid-week dinner",
        "coffee", "ice cream", "pizza", "slices of wisdom", "party", "celebration", "end-of-year celebration",
        "student success celebration", "paws for a study break", "study break", "involvement fair",
        "resource fair", "reception", "appreciation", "make new friends", "community building",
        "rebels after dark", "blind date with a book", "lofi study lounge",
    ],
    "Academics": [
        "academic", "academics", "class", "classes", "course", "coursework", "study week", "instruction ends",
        "last day", "drop", "add classes", "register", "registration", "tuition", "fees", "late penalties",
        "administrative drop", "non-payment", "refund", "myunlv", "calendar", "semester", "commencement",
        "lecture", "seminar", "symposium", "colloquium", "conference", "panel presentation", "faculty panel",
        "research", "undergraduate research", "thesis defense", "dissertation defense", "defense:", "doctoral",
        "proseminar", "anthropology", "science cafe", "teaching", "learning", "pedagogy", "faculty",
        "curriculum", "assessment", "writing center", "writing essentials", "online learning labs",
        "success series", "time management", "study session", "tutoring", "advising", "information session",
        "transfer program", "degree", "bachelor", "masters", "master's",
        "ed.d", "ph.d", "chemical hygiene", "laboratory safety", "rebelperform", "evaluation training",
        "faculty senate", "general education", "tenure", "promotion", "new faculty academy", "information session", "program overview", "admissions information", "degree studies", "spotlight tour", "engineering spotlight tour", "spring break", "communication skills workshop",
    ],
}

# Tie-breaker priority when multiple phrase groups match. Specific identity/community/health/sports
# signals should beat generic academic words like workshop, student, lecture, and training.
PRIORITY = ["Community", "Diversity", "Health", "Sports", "Career", "Tech", "Arts", "Culture", "Social", "Academics"]

# Safer token fallback: keep broad words out of this list. Words like "student", "workshop",
# "training", "game", "support", "performance", "aid", and "rebel" are too noisy.
CATEGORY_KEYWORDS = {
    "Arts": {
        "art", "artist", "gallery", "exhibit", "exhibition", "museum", "music", "concert",
        "orchestra", "choir", "band", "jazz", "guitar", "piano", "recital", "theater",
        "theatre", "film", "dance", "dancing", "poetry", "craft", "crochet",
        "knitting", "yarn", "embroidery", "fashion", "broadcast",
    },
    "Academics": {
        "academic", "class", "classes", "course", "coursework", "research", "lecture",
        "seminar", "symposium", "colloquium", "conference", "thesis", "dissertation",
        "defense", "doctoral", "proseminar", "faculty", "curriculum", "assessment",
        "pedagogy", "writing", "tutoring", "advising", "orientation", "degree",
        "commencement", "tuition", "registration", "webcampus",
    },
    "Career": {
        "career", "resume", "résumé", "interview", "employer", "job", "jobs",
        "internship", "hiring", "recruiting", "networking", "workforce", "linkedin",
        "handshake", "admissions", "application", "scholarship", "fellowship",
        "assistantship", "retirement", "benefits", "mba",
    },
    "Culture": {
        "culture", "cultural", "heritage", "language", "global", "international",
        "holocaust", "remembrance", "chinese", "diaspora", "medieval", "newman",
    },
    "Diversity": {
        "diversity", "equity", "inclusion", "belonging", "identity", "justice",
        "women", "black", "latinx", "hispanic", "asian", "indigenous", "lgbt",
        "lgbtq", "lgbtqia", "queer", "veteran", "disability", "accessibility",
        "decolonizing", "hsi", "monarch", "lavender", "apime",
    },
    "Health": {
        "health", "wellness", "wellbeing", "mental", "mindful", "meditation", "breath",
        "gratitude", "stress", "anxiety", "depression", "recovery", "fitness", "workout",
        "stretch", "yoga", "pilates", "trainer", "nutrition", "eating", "sleep", "counseling",
        "therapy", "medical", "clinic", "clinical", "patient", "cancer", "blood", "narcan", "cpr",
    },
    "Social": {
        "social", "mixer", "meetup", "meeting", "welcome", "trivia", "bingo", "dinner",
        "breakfast", "pizza", "coffee", "party", "celebration", "reception", "friendship",
        "gaming", "games", "snacks",
    },
    "Sports": {
        "athletics", "basketball", "football", "baseball", "softball", "soccer", "tennis",
        "golf", "volleyball", "swimming", "diving", "triathlon", "lacrosse", "snowshoe",
        "trek", "hike", "hiking", "paddleboard", "badminton", "bowling", "jiu", "pool",
    },
    "Tech": {
        "technology", "tech", "ai", "chatgpt", "notebooklm", "data", "nlp", "coding",
        "programming", "software", "computer", "cyber", "cybersecurity", "robotics",
        "stem", "webcampus", "proquest", "podcasting", "recording", "editing", "audio", "video",
    },
    "Community": {
        "community", "service", "volunteer", "outreach", "cleanup", "donation", "fundraiser",
        "charity", "nonprofit", "conservation", "food", "pantry", "bank", "owl", "police",
    },
}


TITLE_OVERRIDES = [
    ("reb general member meetings", "Social"),
    ("spring into spring semester social", "Social"),
    ("money talks", "Career"),
    ("activism through art immersion", "Community"),
    ("bike and scooter registration", "Community"),
    ("corporate wardrobe", "Career"),
    ("graduate mentors: mid-program check-in", "Academics"),
    ("intro to pre-health", "Career"),
    ("intro to pre-law", "Career"),
    ("blood cancer educational seminar", "Health"),
    ("active assailant", "Community"),
    ("law school fair", "Career"),
    ("usac application workshop", "Culture"),
    ("study abroad scholarship", "Culture"),
    ("general study abroad scholarship", "Culture"),
    ("leadership link up", "Career"),
    ("reb event", "Social"),
    ("speakeasy series", "Social"),
    ("science cafe", "Academics"),
    ("volunteer opportunity", "Community"),
    ("dash - meal prep", "Community"),
    ("dash - delivery", "Community"),
    ("emotional intelligence", "Health"),
    ("paws for a study break", "Health"),
    ("late night breakfast", "Social"),
    ("senior design competition", "Tech"),
    ("senior design awards", "Tech"),
    ("does cognitive science show", "Academics"),
    ("communication skills workshop", "Career"),
    ("idea bridge", "Career"),
    ("inspireher", "Diversity"),
    ("paint away stress", "Health"),
    ("family swim", "Sports"),
    ("meet with a tiaa", "Career"),
    ("college of education alumni campus tour", "Social"),
    ("background screening", "Academics"),
    ("abortion and utility", "Academics"),
    ("kerkorian medical education building", "Academics"),
    ("prospective undergraduate engineering spotlight", "Academics"),
    ("unlv/csn transfer program", "Academics"),
    ("rsi workshop series", "Academics"),
    ("nursing: spring break", "Academics"),
    ("nursing: final day", "Academics"),
    ("nursing: last day", "Academics"),
    ("west coast consortium", "Career"),
    ("nevada reading week", "Community"),
    ("farmer's market", "Community"),
    ("women's council fellowship lunch", "Diversity"),
    ("women's council spring gathering", "Diversity"),
    ("women's council vision board", "Diversity"),
    ("natural psychological kinds", "Academics"),
    ("non-compact proofs", "Academics"),
    ("biblical conquest tradition", "Culture"),
    ("rebel awards", "Social"),
    ("3d printing", "Tech"),
    ("consent is as simple as tea", "Health"),
    ("courageous dialogue", "Diversity"),
    ("rebels rising up day", "Social"),
    ("first gen forward", "Diversity"),
    ("city hall to capitol hill", "Community"),
    ("gpsa council meeting", "Academics"),
    ("teaching @ unlv", "Academics"),
    ("teaching unlv", "Academics"),
    ("american founding", "Culture"),
    ("receive criticism", "Career"),
    ("know your rights", "Diversity"),
    ("first gen mentor", "Diversity"),
    ("money and mocktails", "Career"),
    ("final examination", "Academics"),
    ("presidents’ day recess", "Academics"),
    ("presidents' day recess", "Academics"),
    ("palestine", "Culture"),
    ("golden knights", "Sports"),
    ("open enrollment", "Career"),
    ("apime-fsa lunch", "Diversity"),
    ("gelli printmaking", "Arts"),
    ("curricular practical training", "Career"),
    ("earth day", "Community"),
    ("non-tenure track gatherings", "Academics"),
]

AMBIGUOUS_WORDS_TO_AVOID = {
    "workshop", "training", "student", "students", "support", "event", "events", "rebel",
    "rebels", "game", "games", "performance", "perform", "aid", "presentation", "open",
    "house", "meeting", "meetings", "program", "programs", "learning", "education",
}


def _norm(text):
    text = (text or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9+#.\-' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(text):
    return set(re.findall(r"[a-z0-9+#.\-']+", text)) - AMBIGUOUS_WORDS_TO_AVOID


def _contains_phrase(text, phrase):
    # Normalized text is whitespace-separated, so padded substring matching avoids
    # false hits like "art" in "part" without expensive regex calls.
    return f" {phrase} " in f" {text} "

def categorize_event(event):
    title = _norm(event.get("name"))
    for title_fragment, forced_category in TITLE_OVERRIDES:
        if _contains_phrase(title, _norm(title_fragment)):
            return forced_category, [f"title override: {title_fragment}"]
    desc = _norm(event.get("description"))
    loc = _norm(event.get("location"))
    combined = f"{title} {desc} {loc}"

    scores = defaultdict(int)
    reasons = defaultdict(list)

    # Title phrase matches are strongest.
    for category, phrases in PHRASE_RULES.items():
        for phrase in phrases:
            p = _norm(phrase)
            if p and _contains_phrase(title, p):
                scores[category] += 8
                reasons[category].append(f"title phrase: {phrase}")
            elif p and _contains_phrase(combined, p):
                scores[category] += 4
                reasons[category].append(f"text phrase: {phrase}")

    # Token fallback only after phrase scoring.
    toks_title = _tokens(title)
    toks_all = _tokens(combined)
    for category, words in CATEGORY_KEYWORDS.items():
        for word in words:
            w = _norm(word)
            if w in toks_title:
                scores[category] += 3
                reasons[category].append(f"title keyword: {word}")
            elif w in toks_all:
                scores[category] += 1
                reasons[category].append(f"text keyword: {word}")

    # Explicit administrative calendar deadlines are Academics, even if payment words appear.
    admin_academic = [
        "last day", "administrative drop", "instruction ends", "study week begins",
        "tuition and fees", "late penalties", "non-payment", "add classes", "drop and receive",
    ]
    if any(p in title or p in desc for p in admin_academic):
        scores["Academics"] += 10
        reasons["Academics"].append("academic calendar/deadline rule")

    if not scores:
        return None, []

    best_score = max(scores.values())
    candidates = [cat for cat, val in scores.items() if val == best_score]
    for cat in PRIORITY:
        if cat in candidates:
            return cat, reasons[cat][:5]
    return candidates[0], reasons[candidates[0]][:5]
