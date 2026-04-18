import argparse
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.unlv.edu"
URL = f"{BASE_URL}/news/inthenews"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for row in soup.select(".views-row"):
        primary_link = row.select_one(".click-region-link > a[href]")
        title = primary_link.get_text(" ", strip=True) if primary_link else ""
        link = primary_link.get("href", "").strip() if primary_link else ""
        if link.startswith("/"):
            link = urljoin(BASE_URL, link)

        time_node = row.find("time")
        published_at = time_node.get("datetime", "").strip() if time_node else ""
        published_date = time_node.get_text(" ", strip=True) if time_node else ""

        summary_node = row.select_one(".click-region > div > p")
        summary = summary_node.get_text(" ", strip=True) if summary_node else ""

        source_image = row.select_one(".pull-right img")
        source_name = source_image.get("alt", "").strip() if source_image else ""

        if not title or not link:
            continue

        results.append(
            {
                "name": title,
                "category": source_name or "UNLV In The News",
                "section": "In The News",
                "publishedDate": published_date,
                "publishedAt": published_at,
                "summary": summary,
                "link": link,
            }
        )

    return results


def parse_date(value):
    if not value:
        return ""

    for date_format in ("%B %d, %Y",):
        try:
            return datetime.strptime(value.strip(), date_format).date().isoformat()
        except ValueError:
            continue

    return value


def to_public_items(items):
    return [
        {
            "name": item.get("name", ""),
            "category": item.get("category", ""),
            "section": item.get("section", ""),
            "publishedDate": parse_date(item.get("publishedDate", "")),
            "publishedAt": item.get("publishedAt", ""),
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
    parser = argparse.ArgumentParser(description="Export UNLV In The News entries as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write unlvinthenews_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "unlvinthenews_list.json", items)
        print(f"Wrote {len(items)} UNLV In The News items to {Path(args.output_dir) / 'unlvinthenews_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
