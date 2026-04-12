import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path

from webscraping.academic_calendar import scrape as scrape_academic_calendar
from webscraping.involvement_center import scrape as scrape_involvement_center
from webscraping.organizations import scrape as scrape_organizations
from webscraping.rebel_coverage import scrape as scrape_rebel_coverage
from webscraping.unlv_calendar import scrape as scrape_unlv_calendar


def parse_date(value, formats):
    if not value:
        return ""

    for date_format in formats:
        try:
            return datetime.strptime(value.strip(), date_format).date().isoformat()
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


def build_datasets():
    return {
        "academiccalendar_list.json": normalize_academic_calendar(scrape_academic_calendar() or []),
        "involvementcenter_list.json": normalize_involvement_center(scrape_involvement_center() or []),
        "rebelcoverage_list.json": normalize_rebel_coverage(scrape_rebel_coverage() or []),
        "unlvcalendar_list.json": normalize_unlv_calendar(scrape_unlv_calendar() or []),
        "organization_list.json": normalize_organizations(scrape_organizations() or []),
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
