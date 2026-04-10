from bs4 import BeautifulSoup

import webscraping.academic_calendar as academic_calendar
from webscraping.academic_calendar import extract_events_from_page, parse_event_date


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
      <ul>
        <li>
          <a href="/students/academic-calendar/event-1">Fall Registration Begins</a>
          <div>Apr 13</div>
        </li>
        <li>
          <a href="/students/academic-calendar/event-2">Instruction Ends for Summer Session III</a>
          <div>Aug 14</div>
        </li>
        <li>
          <a href="/students/academic-calendar/event-3">Juneteenth Day Recess</a>
          <div>Jun 18</div>
        </li>
      </ul>
    </main>
    """

    result = extract_events_from_page(BeautifulSoup(html, "html.parser"))

    assert result[0]["startDate"].endswith("2026")
    assert result[1]["startDate"].endswith("2026")
    assert result[2]["startDate"].endswith("2027")
