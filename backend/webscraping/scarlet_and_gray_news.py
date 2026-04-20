import argparse
import json
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = "https://unlvscarletandgray.com/category/news/"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}
REQUEST_TIMEOUT = (5, 20)


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for container in soup.select(".td-module-meta-info"):
        title_link = container.select_one(".entry-title a[href]")
        title = title_link.get_text(" ", strip=True) if title_link else ""
        link = title_link.get("href", "").strip() if title_link else ""

        category_link = container.select_one(".td-post-category")
        category = category_link.get_text(" ", strip=True) if category_link else "News"

        time_node = container.select_one("time")
        published_at = time_node.get("datetime", "").strip() if time_node else ""
        published_date = time_node.get_text(" ", strip=True) if time_node else ""

        summary_node = container.select_one(".td-excerpt")
        summary = summary_node.get_text(" ", strip=True) if summary_node else ""

        if not title or not link:
            continue

        results.append(
            {
                "name": title,
                "category": category,
                "section": "Scarlet and Gray News",
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
    response = requests.get(URL, headers=USER_AGENT, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return parse_listing_page(response.text)


def main():
    parser = argparse.ArgumentParser(description="Export Scarlet and Gray News entries as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write scarletandgraynews_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "scarletandgraynews_list.json", items)
        print(f"Wrote {len(items)} Scarlet and Gray News items to {Path(args.output_dir) / 'scarletandgraynews_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
