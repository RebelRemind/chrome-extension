from bs4 import BeautifulSoup

import webscraping.academic_calendar as academic_calendar
from webscraping.academic_calendar import (
    CATALOG_NAV_URL,
    discover_catalog_calendar_urls,
    extract_events_from_catalog_page,
    extract_events_from_current_page,
    merge_academic_calendar_events,
    parse_event_date,
)


def test_parse_event_date_short_month_format():
    result = parse_event_date("Apr 13", 2026)
    assert result is not None
    assert result.strftime("%Y-%m-%d") == "2026-04-13"


def test_extract_events_from_page_rolls_year_forward_when_month_resets(monkeypatch):
    class FixedDateTime:
        @staticmethod
        def now():
            class FixedNow:
                year = 2026

            return FixedNow()

        @staticmethod
        def strptime(*args, **kwargs):
            from datetime import datetime

            return datetime.strptime(*args, **kwargs)

    monkeypatch.setattr(academic_calendar, "datetime", FixedDateTime)

    html = """
    <main>
      <div class="view-content">
        <div class="item-list">
          <ul>
            <li>
              <div class="click-region-link">
                <a href="/students/academic-calendar/event-1">Fall Registration Begins</a>
              </div>
              <div class="description">
                <div class="title-text">Fall Registration Begins</div>
              </div>
              <div class="event-date">
                <span class="event-month">Apr</span>
                <span class="event-day">13</span>
              </div>
            </li>
            <li>
              <div class="click-region-link">
                <a href="/students/academic-calendar/event-2">Instruction Ends for Summer Session III</a>
              </div>
              <div class="description">
                <div class="title-text">Instruction Ends for Summer Session III</div>
              </div>
              <div class="event-date">
                <span class="event-month">Aug</span>
                <span class="event-day">14</span>
              </div>
            </li>
            <li>
              <div class="click-region-link">
                <a href="/students/academic-calendar/event-3">Juneteenth Day Recess</a>
              </div>
              <div class="description">
                <div class="title-text">Juneteenth Day Recess</div>
              </div>
              <div class="event-date">
                <span class="event-month">Jun</span>
                <span class="event-day">18</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </main>
    """

    result = extract_events_from_current_page(BeautifulSoup(html, "html.parser"))

    assert result[0]["startDate"].endswith("2026")
    assert result[1]["startDate"].endswith("2026")
    assert result[2]["startDate"].endswith("2027")
    assert result[0]["link"] == "https://www.unlv.edu/students/academic-calendar/event-1"


def test_extract_events_from_catalog_page_reads_semester_tables():
    html = """
    <main>
      <h1 id="acalog-content">Academic Calendar Fall 2025-Summer 2026</h1>
      <p><strong>Fall 2025</strong></p>
      <table>
        <tbody>
          <tr>
            <td><p>Monday, August 25, 2025</p></td>
            <td><p>Classes begin.</p></td>
          </tr>
          <tr>
            <td><p>Friday, August 29, 2025</p></td>
            <td><p>Last day to register without late penalties.</p></td>
          </tr>
        </tbody>
      </table>
      <p><strong>Spring 2026</strong></p>
      <table>
        <tbody>
          <tr>
            <td><p>Tuesday, January 20, 2026</p></td>
            <td><p>Classes begin.</p></td>
          </tr>
        </tbody>
      </table>
    </main>
    """

    result = extract_events_from_catalog_page(BeautifulSoup(html, "html.parser"), "https://catalog.unlv.edu/content.php?catoid=50&navoid=15615")

    assert len(result) == 3
    assert result[0]["name"] == "Classes begin."
    assert result[0]["startDate"] == "Monday, August 25, 2025"
    assert result[0]["link"] == "https://catalog.unlv.edu/content.php?catoid=50&navoid=15615"
    assert result[2]["startDate"] == "Tuesday, January 20, 2026"


def test_discover_catalog_calendar_urls_returns_first_two_calendar_links():
    html = """
    <main>
      <a href="/content.php?catoid=50&navoid=17405">Academic Calendar Fall 2028-Summer 2029</a>
      <a href="/content.php?catoid=50&navoid=17406">Academic Calendar Fall 2029-Summer 2030</a>
      <p>Select the desired catalog:</p>
      <ul>
        <li><a href="content.php?catoid=50&navoid=15615" target="_blank">Fall 2025 - Summer 2026</a></li>
        <li><a href="content.php?catoid=50&navoid=15611" target="_blank">Fall 2026 - Summer 2027</a></li>
        <li><a href="content.php?catoid=50&navoid=15662" target="_blank">Fall 2027 - Summer 2028</a></li>
      </ul>
    </main>
    """

    result = discover_catalog_calendar_urls(BeautifulSoup(html, "html.parser"), limit=2)

    assert result == [
        f"{CATALOG_NAV_URL.rsplit('/', 1)[0]}/content.php?catoid=50&navoid=15615",
        f"{CATALOG_NAV_URL.rsplit('/', 1)[0]}/content.php?catoid=50&navoid=15611",
    ]


def test_merge_academic_calendar_events_prefers_current_page_links():
    current_events = [
        {
            "name": "Registration Opens",
            "startDate": "Tuesday, April 14, 2026",
            "endDate": "Tuesday, April 14, 2026",
            "link": "https://www.unlv.edu/current/registration-opens",
        },
        {
            "name": "Study Week Begins",
            "startDate": "Monday, April 13, 2026",
            "endDate": "Monday, April 13, 2026",
            "link": "https://www.unlv.edu/current/study-week",
        },
    ]
    catalog_events = [
        {
            "name": "Study Week Begins",
            "startDate": "Monday, April 13, 2026",
            "endDate": "Monday, April 13, 2026",
            "link": "https://catalog.unlv.edu/content.php?catoid=50&navoid=15615",
        },
        {
            "name": "Instruction Ends",
            "startDate": "Friday, April 10, 2026",
            "endDate": "Friday, April 10, 2026",
            "link": "https://catalog.unlv.edu/content.php?catoid=50&navoid=15615",
        },
    ]

    result = merge_academic_calendar_events(current_events, catalog_events)

    assert [item["name"] for item in result] == [
        "Instruction Ends",
        "Study Week Begins",
        "Registration Opens",
    ]
    assert result[0]["link"] == "https://catalog.unlv.edu/content.php?catoid=50&navoid=15615"
    assert result[1]["link"] == "https://www.unlv.edu/current/study-week"
    assert result[2]["link"] == "https://www.unlv.edu/current/registration-opens"
