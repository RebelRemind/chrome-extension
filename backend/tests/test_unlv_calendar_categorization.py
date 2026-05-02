from webscraping.unlv_calendar import (
    build_building_image_lookup,
    categorize_event,
    extract_event_image_url,
    fetch_event_details,
    parse_unlv_detail_time_range,
    resolve_building_image,
    scrape,
)
from requests import RequestException


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


def test_parse_unlv_detail_time_range_extracts_times_from_event_date_text():
    assert parse_unlv_detail_time_range("May. 5, 2026, 9am to 4pm") == ("9:00 AM", "4:00 PM")


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
    assert result["_imageSource"] == "building"
    assert result["startTime"] == "3:30 PM"
    assert result["endTime"] == "5:00 PM"


def test_fetch_event_details_parses_event_first_date_markup(monkeypatch):
    class Response:
        text = """
        <html>
          <head>
            <meta property="og:image" content="/sites/default/files/alumni-tour.jpg" />
            <meta name="description" content="Tour campus with College of Education alumni." />
          </head>
          <body>
            <div class="event-dates">
              <h3>When</h3>
              <div class="event-first-date">
                May. 5, 2026, 9am to 4pm
              </div>
            </div>
          </body>
        </html>
        """

        def raise_for_status(self):
            return None

    monkeypatch.setattr("webscraping.unlv_calendar.requests.get", lambda *args, **kwargs: Response())

    result = fetch_event_details("https://www.unlv.edu/event/college-education-alumni-campus-tour-8")

    assert result["description"] == "Tour campus with College of Education alumni."
    assert result["imageUrl"] == "https://www.unlv.edu/sites/default/files/alumni-tour.jpg"
    assert result["_imageSource"] == "event_page"
    assert result["startTime"] == "9:00 AM"
    assert result["endTime"] == "4:00 PM"


def test_fetch_event_details_retries_detail_page_after_request_failure(monkeypatch):
    class Response:
        text = """
        <html>
          <body>
            <h3>When</h3>
            <div>May. 5, 2026, 9am to 4pm</div>
          </body>
        </html>
        """

        def raise_for_status(self):
            return None

    calls = []

    def fake_get(*args, **kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            raise RequestException("temporary failure")
        return Response()

    monkeypatch.setattr("webscraping.unlv_calendar.requests.get", fake_get)

    result = fetch_event_details("https://www.unlv.edu/event/college-education-alumni-campus-tour-8")

    assert len(calls) == 2
    assert result["endTime"] == "4:00 PM"


def test_scrape_enriches_new_events_from_detail_page(monkeypatch):
    class Response:
        def __init__(self, text, status_code=200):
            self.text = text
            self.status_code = status_code

        def raise_for_status(self):
            return None

    listing_html = """
    <html>
      <body>
        <div class="card-header">Monday, May 04, 2026</div>
        <div class="col-sm-10">
          <a href="/event/new-campus-event">New Campus Event</a>
        </div>
        <div class="col-sm-2">3:30pm</div>
        <div class="col-sm-12 text-sm">Student Union</div>
      </body>
    </html>
    """
    detail_html = """
    <html>
      <head>
        <meta property="og:image" content="/sites/default/files/new-campus-event.jpg" />
        <meta name="description" content="A freshly scraped event description." />
      </head>
      <body>
        <h2>Campus Location</h2>
        <p>Student Union</p>
        <h2>When</h2>
        <p>May. 4, 2026, 3:30pm to 5pm</p>
      </body>
    </html>
    """

    def fake_get(url, *args, **kwargs):
        if url == "https://www.unlv.edu/calendar/2026-W19":
            return Response(listing_html)
        if url == "https://www.unlv.edu/maps/buildings":
            return Response("<html></html>")
        if url == "https://www.unlv.edu/event/new-campus-event":
            return Response(detail_html)
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("webscraping.unlv_calendar.iter_week_urls", lambda: ["https://www.unlv.edu/calendar/2026-W19"])
    monkeypatch.setattr("webscraping.unlv_calendar.requests.get", fake_get)

    events = scrape()

    assert len(events) == 1
    assert events[0]["description"] == "A freshly scraped event description."
    assert events[0]["imageUrl"] == "https://www.unlv.edu/sites/default/files/new-campus-event.jpg"
    assert events[0]["startTime"] == "3:30 PM"
    assert events[0]["endTime"] == "5:00 PM"
    assert "_imageSource" not in events[0]


def test_scrape_uses_building_image_before_default_logo(monkeypatch):
    class Response:
        def __init__(self, text, status_code=200):
            self.text = text
            self.status_code = status_code

        def raise_for_status(self):
            return None

    listing_html = """
    <html>
      <body>
        <div class="card-header">Monday, May 04, 2026</div>
        <div class="col-sm-10">
          <a href="/event/new-campus-event-without-image">New Campus Event Without Image</a>
        </div>
        <div class="col-sm-2">3:30pm</div>
        <div class="col-sm-12 text-sm">Student Union</div>
      </body>
    </html>
    """
    buildings_html = """
    <html>
      <body>
        <div class="card bg-white views-row">
          <img src="/sites/default/files/styles/large/public/building_images/student-union.jpg" />
          <h4 class="h6 clear-margin-top">SU: Student Union</h4>
        </div>
      </body>
    </html>
    """
    detail_html = """
    <html>
      <head>
        <meta name="description" content="A building-image fallback event." />
      </head>
      <body>
        <h2>Campus Location</h2>
        <p>Student Union</p>
        <h2>When</h2>
        <p>May. 4, 2026, 3:30pm to 5pm</p>
      </body>
    </html>
    """

    def fake_get(url, *args, **kwargs):
        if url == "https://www.unlv.edu/calendar/2026-W19":
            return Response(listing_html)
        if url == "https://www.unlv.edu/maps/buildings":
            return Response(buildings_html)
        if url == "https://www.unlv.edu/event/new-campus-event-without-image":
            return Response(detail_html)
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("webscraping.unlv_calendar.iter_week_urls", lambda: ["https://www.unlv.edu/calendar/2026-W19"])
    monkeypatch.setattr("webscraping.unlv_calendar.requests.get", fake_get)

    events = scrape()

    assert len(events) == 1
    assert events[0]["description"] == "A building-image fallback event."
    assert events[0]["imageUrl"] == "https://www.unlv.edu/sites/default/files/styles/large/public/building_images/student-union.jpg"
    assert events[0]["imageUrl"] != "/images/UNLV_Logo.png"
