from export_pages_data import (
    format_time,
    normalize_academic_calendar,
    normalize_involvement_center,
    normalize_rebel_coverage,
    normalize_unlv_calendar,
)


def test_format_time_normalizes_24_hour_time():
    assert format_time("14:30:00") == "2:30 PM"


def test_normalize_academic_calendar_converts_date():
    result = normalize_academic_calendar(
        [{
            "name": "Spring Break",
            "startDate": "Monday, March 17, 2025",
            "endDate": "Monday, March 17, 2025",
            "link": "https://example.com/academic",
        }]
    )
    assert result[0]["startDate"] == "2025-03-17"
    assert result[0]["link"] == "https://example.com/academic"


def test_normalize_involvement_center_preserves_iso_dates():
    result = normalize_involvement_center(
        [{
            "name": "Club Meeting",
            "startDate": "2025-05-05",
            "startTime": "05:30 PM",
            "endDate": "2025-05-05",
            "endTime": "07:30 PM",
            "organization": "Layer Zero",
            "location": "TBE B174",
            "link": "https://example.com",
        }]
    )
    assert result[0]["startDate"] == "2025-05-05"


def test_normalize_rebel_coverage_converts_us_date():
    result = normalize_rebel_coverage(
        [{"name": "Baseball Game", "startDate": "05/02/2025", "sport": "Baseball"}]
    )
    assert result[0]["startDate"] == "2025-05-02"


def test_normalize_unlv_calendar_converts_verbose_date():
    result = normalize_unlv_calendar(
        [{"name": "Tech Seminar", "startDate": "Tuesday, April 29, 2025", "category": "Tech"}]
    )
    assert result[0]["startDate"] == "2025-04-29"
