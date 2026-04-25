from webscraping.unlv_calendar import (
    build_building_image_lookup,
    categorize_event,
    extract_event_image_url,
    fetch_event_details,
    resolve_building_image,
)


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


def test_extract_event_image_url_prefers_open_graph_image():
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(
        """
        <html>
          <head>
            <meta property="og:image" content="/sites/default/files/event-image.jpg" />
          </head>
        </html>
        """,
        "html.parser",
    )

    assert extract_event_image_url(soup) == "https://www.unlv.edu/sites/default/files/event-image.jpg"


def test_resolve_building_image_matches_campus_location_to_building_name():
    lookup = build_building_image_lookup([
        {
            "bldg-code": "SU",
            "bldg-name": "Student Union",
            "image-link": "https://www.unlv.edu/student-union.jpg",
        }
    ])

    assert resolve_building_image("Student Union", lookup) == "https://www.unlv.edu/student-union.jpg"


def test_resolve_building_image_maps_srwc_to_rwc():
    lookup = build_building_image_lookup([
        {
            "bldg-code": "RWC",
            "bldg-name": "Student Recreation & Wellness Center",
            "image-link": "https://www.unlv.edu/rwc.jpg",
        }
    ])

    assert resolve_building_image("SRWC", lookup) == "https://www.unlv.edu/rwc.jpg"


def test_fetch_event_details_falls_back_to_building_image_when_event_has_no_image(monkeypatch):
    class Response:
        text = """
        <html>
          <head>
            <meta property="og:description" content="Join us for an event." />
          </head>
          <body>
            <h2>Campus Location</h2>
            <p>Student Union</p>
            <h2>When</h2>
            <p>Apr. 28, 2026, 3:30pm to 5pm</p>
          </body>
        </html>
        """

        def raise_for_status(self):
            return None

    monkeypatch.setattr("webscraping.unlv_calendar.requests.get", lambda *args, **kwargs: Response())

    result = fetch_event_details(
        "https://www.unlv.edu/event/example",
        {"student union": "https://www.unlv.edu/student-union.jpg"},
    )

    assert result["description"] == "Join us for an event."
    assert result["campusLocation"] == "Student Union"
    assert result["imageUrl"] == "https://www.unlv.edu/student-union.jpg"
    assert result["startTime"] == "3:30 PM"
    assert result["endTime"] == "5:00 PM"
