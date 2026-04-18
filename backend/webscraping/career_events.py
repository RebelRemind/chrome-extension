import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = "https://careerlaunch.unlv.edu/events/"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}


def parse_event_start_date(value):
    if not value:
        return ""

    match = re.search(r"([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})", value)
    if not match:
        return ""

    try:
        return datetime.strptime(match.group(1), "%A, %B %d, %Y").date().isoformat()
    except ValueError:
        return ""


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for item in soup.select(".type-event"):
        link_node = item.select_one("a[href]")
        title_node = item.select_one(".title")
        date_node = item.select_one(".event-date")
        time_node = item.select_one(".event-time")
        location_node = item.select_one(".event-location")

        title = title_node.get_text(" ", strip=True).replace("Event:", "").strip() if title_node else ""
        link = link_node.get("href", "").strip() if link_node else ""
        date_label = date_node.get_text(" ", strip=True) if date_node else ""
        time_label = time_node.get_text(" ", strip=True) if time_node else ""
        location = location_node.get_text(" ", strip=True) if location_node else ""

        if not title or not link:
            continue

        summary_parts = [part for part in [date_label, time_label, location] if part]

        results.append(
            {
                "name": title,
                "category": "Career Event",
                "section": "Upcoming Career Events",
                "startDate": parse_event_start_date(date_label),
                "summary": " | ".join(summary_parts),
                "location": location,
                "link": link,
            }
        )

    return results


def to_public_items(items):
    return [
        {
            "name": item.get("name", ""),
            "category": item.get("category", ""),
            "section": item.get("section", ""),
            "startDate": item.get("startDate", ""),
            "summary": item.get("summary", ""),
            "location": item.get("location", ""),
            "link": item.get("link", ""),
        }
        for item in items
    ]


def write_json(output_dir, file_name, payload):
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / file_name).open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def scrape():
    response = requests.get(URL, headers=USER_AGENT, timeout=15)
    response.raise_for_status()
    return parse_listing_page(response.text)


def main():
    parser = argparse.ArgumentParser(description="Export Career Launch events as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write careerevents_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "careerevents_list.json", items)
        print(f"Wrote {len(items)} career events to {Path(args.output_dir) / 'careerevents_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
