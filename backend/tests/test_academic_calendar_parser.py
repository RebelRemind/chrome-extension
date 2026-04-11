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

    result = extract_events_from_page(BeautifulSoup(html, "html.parser"))

    assert result[0]["startDate"].endswith("2026")
    assert result[1]["startDate"].endswith("2026")
    assert result[2]["startDate"].endswith("2027")
    assert result[0]["link"] == "https://www.unlv.edu/students/academic-calendar/event-1"
