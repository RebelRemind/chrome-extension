import argparse
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
import traceback

from webscraping.academic_calendar import scrape as scrape_academic_calendar
from webscraping.building_images import scrape as scrape_building_images, to_public_items as normalize_building_images
from webscraping.campus_wide_events import scrape as scrape_campus_wide_events, to_public_items as normalize_campus_wide_events
from webscraping.career_events import scrape as scrape_career_events, to_public_items as normalize_career_events
from webscraping.involvement_center import scrape as scrape_involvement_center
from webscraping.organizations import scrape as scrape_organizations
from webscraping.rebel_coverage import scrape as scrape_rebel_coverage
from webscraping.scarlet_and_gray_news import scrape as scrape_scarlet_and_gray_news, to_public_items as normalize_scarlet_and_gray_news
from webscraping.unlv_calendar import scrape as scrape_unlv_calendar
from webscraping.unlv_in_the_news import scrape as scrape_unlv_in_the_news, to_public_items as normalize_unlv_in_the_news
from webscraping.unlv_today import scrape as scrape_unlv_today, to_public_items as normalize_unlv_today


def parse_date(value, formats):
    if not value:
        return ""

    for date_format in formats:
        try:
            return datetime.strptime(value.strip(), date_format).date().isoformat()
        except ValueError:
            continue

    return value


def format_time(value):
    if not value:
        return ""

    for time_format in ("%H:%M:%S", "%H:%M"):
        try:
            parsed = datetime.strptime(value.strip(), time_format)
            return parsed.strftime("%-I:%M %p")
        except ValueError:
            continue

    return value


def normalize_academic_calendar(items):
    normalized = []
    for item in items:
        start_date = parse_date(item.get("startDate", ""), ("%A, %B %d, %Y",))
        end_date = parse_date(item.get("endDate", ""), ("%A, %B %d, %Y",))
        normalized.append(
            {
                "name": item.get("name", ""),
                "startDate": start_date,
                "startTime": item.get("startTime", ""),
                "endDate": end_date,
                "endTime": item.get("endTime", ""),
                "link": item.get("link", ""),
            }
        )
    return normalized


def normalize_involvement_center(items):
    normalized = []
    for item in items:
        normalized.append(
            {
                "name": item.get("name", ""),
                "startDate": parse_date(item.get("startDate", ""), ("%Y-%m-%d",)),
                "startTime": item.get("startTime", ""),
                "endDate": parse_date(item.get("endDate", ""), ("%Y-%m-%d",)),
                "endTime": item.get("endTime", ""),
                "location": item.get("location", ""),
                "organization": item.get("organization", ""),
                "description": item.get("description", ""),
                "imageUrl": item.get("imageUrl", ""),
                "link": item.get("link", ""),
            }
        )
    return normalized


def normalize_rebel_coverage(items):
    normalized = []
    for item in items:
        start_date = parse_date(item.get("startDate", ""), ("%m/%d/%Y",))
        end_date = parse_date(item.get("endDate", "") or item.get("startDate", ""), ("%m/%d/%Y",))
        normalized.append(
            {
                "name": item.get("name", ""),
                "startDate": start_date,
                "startTime": item.get("startTime", ""),
                "endDate": end_date,
                "endTime": item.get("endTime", ""),
                "location": item.get("location", ""),
                "sport": item.get("sport", ""),
                "link": item.get("link", ""),
            }
        )
    return normalized


def normalize_unlv_calendar(items):
    normalized = []
    for item in items:
        start_date = parse_date(item.get("startDate", ""), ("%A, %B %d, %Y",))
        end_date = parse_date(item.get("endDate", "") or item.get("startDate", ""), ("%A, %B %d, %Y",))
        normalized.append(
            {
                "name": item.get("name", ""),
                "startDate": start_date,
                "startTime": item.get("startTime", ""),
                "endDate": end_date,
                "endTime": item.get("endTime", ""),
                "location": item.get("location", ""),
                "description": item.get("description", ""),
                "category": item.get("category"),
                "imageUrl": item.get("imageUrl", ""),
                "link": item.get("link", ""),
            }
        )
    return normalized


def normalize_organizations(items):
    return [
        {
            "name": item.get("name", ""),
            "imageUrl": item.get("imageUrl", ""),
            "link": item.get("link", ""),
        }
        for item in items
    ]


def write_json(output_dir, file_name, payload):
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / file_name).open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def load_fallback_dataset(fallback_dir, file_name):
    if not fallback_dir:
        return None

    fallback_path = Path(fallback_dir) / file_name
    if not fallback_path.exists():
        return None

    try:
        with fallback_path.open("r", encoding="utf-8") as file_handle:
            payload = json.load(file_handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[pages-data] Failed to read fallback {fallback_path}: {exc}", flush=True)
        return None

    if not isinstance(payload, list):
        print(f"[pages-data] Ignoring fallback {fallback_path}: expected a JSON list", flush=True)
        return None

    print(f"[pages-data] Using fallback data from {fallback_path}", flush=True)
    return payload


def build_dataset(file_name, scraper, normalizer, fallback_dir=None, fallback_if_empty=False):
    try:
        payload = normalizer(scraper() or [])
        if payload or not fallback_if_empty:
            return payload

        fallback_payload = load_fallback_dataset(fallback_dir, file_name)
        if fallback_payload is not None:
            print(f"[pages-data] Built empty {file_name}; keeping last published data.", flush=True)
            return fallback_payload

        return payload
    except Exception as exc:
        print(f"[pages-data] Failed to build {file_name}: {exc}", flush=True)
        print(traceback.format_exc(), flush=True)
        fallback_payload = load_fallback_dataset(fallback_dir, file_name)
        if fallback_payload is not None:
            return fallback_payload
        return []


def build_datasets(fallback_dir=None):
    return {
        "academiccalendar_list.json": build_dataset(
            "academiccalendar_list.json",
            scrape_academic_calendar,
            normalize_academic_calendar,
            fallback_dir,
        ),
        "buildingimages_list.json": build_dataset(
            "buildingimages_list.json",
            scrape_building_images,
            normalize_building_images,
            fallback_dir,
        ),
        "campuswideevents_list.json": build_dataset(
            "campuswideevents_list.json",
            scrape_campus_wide_events,
            normalize_campus_wide_events,
            fallback_dir,
        ),
        "careerevents_list.json": build_dataset(
            "careerevents_list.json",
            scrape_career_events,
            normalize_career_events,
            fallback_dir,
        ),
        "involvementcenter_list.json": build_dataset(
            "involvementcenter_list.json",
            scrape_involvement_center,
            normalize_involvement_center,
            fallback_dir,
        ),
        "rebelcoverage_list.json": build_dataset(
            "rebelcoverage_list.json",
            scrape_rebel_coverage,
            normalize_rebel_coverage,
            fallback_dir,
        ),
        "scarletandgraynews_list.json": build_dataset(
            "scarletandgraynews_list.json",
            scrape_scarlet_and_gray_news,
            normalize_scarlet_and_gray_news,
            fallback_dir,
            fallback_if_empty=True,
        ),
        "unlvinthenews_list.json": build_dataset(
            "unlvinthenews_list.json",
            scrape_unlv_in_the_news,
            normalize_unlv_in_the_news,
            fallback_dir,
            fallback_if_empty=True,
        ),
        "unlvcalendar_list.json": build_dataset(
            "unlvcalendar_list.json",
            scrape_unlv_calendar,
            normalize_unlv_calendar,
            fallback_dir,
        ),
        "unlvtoday_list.json": build_dataset(
            "unlvtoday_list.json",
            scrape_unlv_today,
            normalize_unlv_today,
            fallback_dir,
            fallback_if_empty=True,
        ),
        "organization_list.json": build_dataset(
            "organization_list.json",
            scrape_organizations,
            normalize_organizations,
            fallback_dir,
        ),
    }


def main():
    parser = argparse.ArgumentParser(description="Export RebelRemind static JSON for GitHub Pages.")
    parser.add_argument("--output-dir", default="generated-pages-data", help="Directory to write JSON files into.")
    parser.add_argument("--fallback-dir", help="Directory with the last published JSON files to keep when a source fails.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    datasets = build_datasets(args.fallback_dir)

    for file_name, payload in datasets.items():
        write_json(output_dir, file_name, payload)

    metadata = {
        "generatedAt": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "files": sorted(datasets.keys()),
    }
    write_json(output_dir, "index.json", metadata)


if __name__ == "__main__":
    main()
