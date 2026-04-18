import argparse
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.unlv.edu"
URL = f"{BASE_URL}/sia/events"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}


def parse_date_label(month_label, day_label):
    if not month_label or not day_label:
        return ""

    today = datetime.now().date()
    for year in (today.year, today.year + 1):
        try:
            parsed = datetime.strptime(f"{month_label} {day_label} {year}", "%b %d %Y").date()
        except ValueError:
            continue

        if parsed >= today.replace(month=1, day=1):
            return parsed.isoformat()

    return ""


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for item in soup.select(".item-list li"):
        link_node = item.select_one(".click-region-link a[href]")
        title_node = item.select_one(".title-text")
        summary_node = item.select_one(".description p")
        month_node = item.select_one(".event-month")
        day_node = item.select_one(".event-day")

        title = title_node.get_text(" ", strip=True) if title_node else ""
        link = urljoin(BASE_URL, link_node.get("href", "").strip()) if link_node else ""
        summary = summary_node.get_text(" ", strip=True) if summary_node else ""
        month_label = month_node.get_text(" ", strip=True) if month_node else ""
        day_label = day_node.get_text(" ", strip=True) if day_node else ""

        if not title or not link:
            continue

        results.append(
            {
                "name": title,
                "category": "Campus-Wide Event",
                "section": "Campus-Wide Events",
                "startDate": parse_date_label(month_label, day_label),
                "summary": summary,
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
    parser = argparse.ArgumentParser(description="Export campus-wide UNLV events as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write campuswideevents_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "campuswideevents_list.json", items)
        print(f"Wrote {len(items)} campus-wide events to {Path(args.output_dir) / 'campuswideevents_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
