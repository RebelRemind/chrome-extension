import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
import traceback

from webscraping.academic_calendar import scrape as scrape_academic_calendar
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
                "link": item.get("link", ""),
            }
        )
    return normalized


def normalize_organizations(items):
    return [{"name": item.get("name", "")} for item in items]


def write_json(output_dir, file_name, payload):
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / file_name).open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def build_dataset(file_name, scraper, normalizer):
    try:
        return normalizer(scraper() or [])
    except Exception as exc:
        print(f"[pages-data] Failed to build {file_name}: {exc}", flush=True)
        print(traceback.format_exc(), flush=True)
        return []


def build_datasets():
    return {
        "academiccalendar_list.json": build_dataset(
            "academiccalendar_list.json",
            scrape_academic_calendar,
            normalize_academic_calendar,
        ),
        "involvementcenter_list.json": build_dataset(
            "involvementcenter_list.json",
            scrape_involvement_center,
            normalize_involvement_center,
        ),
        "rebelcoverage_list.json": build_dataset(
            "rebelcoverage_list.json",
            scrape_rebel_coverage,
            normalize_rebel_coverage,
        ),
        "scarletandgraynews_list.json": build_dataset(
            "scarletandgraynews_list.json",
            scrape_scarlet_and_gray_news,
            normalize_scarlet_and_gray_news,
        ),
        "unlvinthenews_list.json": build_dataset(
            "unlvinthenews_list.json",
            scrape_unlv_in_the_news,
            normalize_unlv_in_the_news,
        ),
        "unlvcalendar_list.json": build_dataset(
            "unlvcalendar_list.json",
            scrape_unlv_calendar,
            normalize_unlv_calendar,
        ),
        "unlvtoday_list.json": build_dataset(
            "unlvtoday_list.json",
            scrape_unlv_today,
            normalize_unlv_today,
        ),
        "organization_list.json": build_dataset(
            "organization_list.json",
            scrape_organizations,
            normalize_organizations,
        ),
    }


def main():
    parser = argparse.ArgumentParser(description="Export RebelRemind static JSON for GitHub Pages.")
    parser.add_argument("--output-dir", default="generated-pages-data", help="Directory to write JSON files into.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    datasets = build_datasets()

    for file_name, payload in datasets.items():
        write_json(output_dir, file_name, payload)

    metadata = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "files": sorted(datasets.keys()),
    }
    write_json(output_dir, "index.json", metadata)


if __name__ == "__main__":
    main()
