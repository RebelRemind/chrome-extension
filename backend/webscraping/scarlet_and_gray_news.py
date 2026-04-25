import argparse
import json
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
import xml.etree.ElementTree as ET

import requests
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup
from urllib3.util.retry import Retry


URL = "https://unlvscarletandgray.com/category/news/feed/"

USER_AGENT = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/144.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = (10, 30)
RETRY_STATUS_CODES = (429, 500, 502, 503, 504)


def clean_html(value):
    if not value:
        return ""

    return BeautifulSoup(value, "html.parser").get_text(" ", strip=True)


def parse_feed(xml_text):
    root = ET.fromstring(xml_text)
    channel = root.find("channel")

    if channel is None:
        return []

    results = []

    for item in channel.findall("item"):
        title = item.findtext("title", default="").strip()
        link = item.findtext("link", default="").strip()
        pub_date_raw = item.findtext("pubDate", default="").strip()
        description = item.findtext("description", default="").strip()

        categories = [
            category.text.strip()
            for category in item.findall("category")
            if category.text and category.text.strip()
        ]

        published_at = ""
        published_date = ""

        if pub_date_raw:
            try:
                parsed_date = parsedate_to_datetime(pub_date_raw)
                published_at = parsed_date.isoformat()
                published_date = parsed_date.date().isoformat()
            except (TypeError, ValueError):
                published_date = pub_date_raw

        if not title or not link:
            continue

        results.append(
            {
                "name": title,
                "category": categories[0] if categories else "News",
                "section": "Scarlet and Gray News",
                "publishedDate": published_date,
                "publishedAt": published_at,
                "summary": clean_html(description),
                "link": link,
            }
        )

    return results


def parse_date(value):
    if not value:
        return ""

    # Already ISO date from RSS parsing
    try:
        return datetime.fromisoformat(value).date().isoformat()
    except ValueError:
        pass

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


def fetch_text(url):
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=2,
        status_forcelist=RETRY_STATUS_CODES,
        allowed_methods=("GET",),
        respect_retry_after_header=True,
        raise_on_status=False,
    )

    adapter = HTTPAdapter(max_retries=retry)

    with requests.Session() as session:
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        response = session.get(url, headers=USER_AGENT, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.text


def scrape():
    return parse_feed(fetch_text(URL))


def main():
    parser = argparse.ArgumentParser(description="Export Scarlet and Gray News entries as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write scarletandgraynews_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())

    if args.output_dir:
        output_path = Path(args.output_dir) / "scarletandgraynews_list.json"
        write_json(Path(args.output_dir), "scarletandgraynews_list.json", items)
        print(f"Wrote {len(items)} Scarlet and Gray News items to {output_path}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()