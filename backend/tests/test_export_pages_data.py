import json

from export_pages_data import (
    build_dataset,
    format_time,
    normalize_academic_calendar,
    normalize_involvement_center,
    normalize_rebel_coverage,
    normalize_unlv_calendar,
    normalize_unlv_today,
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
            "description": "Weekly project night.",
            "link": "https://example.com",
        }]
    )
    assert result[0]["startDate"] == "2025-05-05"
    assert result[0]["description"] == "Weekly project night."


def test_normalize_rebel_coverage_converts_us_date():
    result = normalize_rebel_coverage(
        [{"name": "Baseball Game", "startDate": "05/02/2025", "sport": "Baseball"}]
    )
    assert result[0]["startDate"] == "2025-05-02"


def test_normalize_unlv_calendar_converts_verbose_date():
    result = normalize_unlv_calendar(
        [{
            "name": "Tech Seminar",
            "startDate": "Tuesday, April 29, 2025",
            "category": "Tech",
            "description": "AI workshop",
            "imageUrl": "https://www.unlv.edu/example.jpg",
        }]
    )
    assert result[0]["startDate"] == "2025-04-29"
    assert result[0]["description"] == "AI workshop"
    assert result[0]["imageUrl"] == "https://www.unlv.edu/example.jpg"


def test_normalize_unlv_today_converts_publish_date():
    result = normalize_unlv_today(
        [{
            "name": "Podcast: How AI Can Improve Instructional Design",
            "category": "Announcements",
            "section": "More from the Last Week",
            "publishedDate": "April 14, 2026",
            "publishedAt": "2026-04-14T13:14:44-07:00",
            "summary": "Learn how AI can improve instructional design.",
            "link": "https://www.unlv.edu/news/unlvtoday/podcast-how-ai-can-improve-instructional-design",
        }]
    )
    assert result[0]["publishedDate"] == "2026-04-14"
    assert result[0]["category"] == "Announcements"


def test_build_dataset_returns_empty_list_when_scraper_fails():
    def failing_scraper():
        raise TimeoutError("source timed out")

    result = build_dataset("scarletandgraynews_list.json", failing_scraper, lambda items: items)

    assert result == []


def test_build_dataset_uses_fallback_when_scraper_fails(tmp_path):
    fallback_dir = tmp_path / "data"
    fallback_dir.mkdir()
    fallback_payload = [{"name": "Last published story"}]
    (fallback_dir / "scarletandgraynews_list.json").write_text(
        json.dumps(fallback_payload),
        encoding="utf-8",
    )

    def failing_scraper():
        raise TimeoutError("source timed out")

    result = build_dataset(
        "scarletandgraynews_list.json",
        failing_scraper,
        lambda items: items,
        fallback_dir=fallback_dir,
    )

    assert result == fallback_payload


def test_build_dataset_uses_fallback_when_news_scraper_returns_empty(tmp_path):
    fallback_dir = tmp_path / "data"
    fallback_dir.mkdir()
    fallback_payload = [{"name": "Last published UNLV Today item"}]
    (fallback_dir / "unlvtoday_list.json").write_text(
        json.dumps(fallback_payload),
        encoding="utf-8",
    )

    result = build_dataset(
        "unlvtoday_list.json",
        lambda: [],
        lambda items: items,
        fallback_dir=fallback_dir,
        fallback_if_empty=True,
    )

    assert result == fallback_payload
