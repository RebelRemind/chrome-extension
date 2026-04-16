from webscraping.unlv_calendar import categorize_event


def test_categorize_event_arts():
    assert categorize_event("Film Screening and Live Music Night") == "Arts"


def test_categorize_event_career():
    assert categorize_event("Career Fair and Resume Workshop") == "Career"


def test_categorize_event_health():
    assert categorize_event("Mental Health and Wellness Week") == "Health"


def test_categorize_event_tech():
    assert categorize_event("Computer Science and AI Hackathon") == "Tech"


def test_categorize_event_returns_none_when_no_match():
    assert categorize_event("Sunset Gathering") is None


def test_categorize_event_sports():
    assert categorize_event("Football Game Watch Party") == "Sports"


def test_categorize_event_uses_description_context():
    assert categorize_event("Starting Strong", "Student success series workshop for new Rebels") == "Academics"


def test_categorize_event_buckets_teaching_webcampus():
    assert categorize_event("Teaching @ UNLV: Introduction to Teaching with WebCampus") == "Academics"


def test_categorize_event_buckets_lunar_new_year():
    assert categorize_event("Lunar New Year Night Market") == "Culture"
