from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import json
from urllib.parse import urljoin
from pathlib import Path
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup
from urllib3.util.retry import Retry

BASE_URL = "https://www.unlv.edu"
URL = f"{BASE_URL}/news/unlvtoday"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}
DETAIL_FETCH_WORKERS = 2
RETRY_STATUS_CODES = (429, 500, 502, 503, 504)


def parse_date(value):
    if not value:
        return ""

    for date_format in ("%B %d, %Y",):
        try:
            return datetime.strptime(value.strip(), date_format).date().isoformat()
        except ValueError:
            continue

    return value


def fetch_text(url, timeout):
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
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    try:
        response = session.get(url, headers=USER_AGENT, timeout=timeout)
        response.raise_for_status()
        return response.text
    finally:
        session.close()


def write_json(output_dir, file_name, payload):
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / file_name).open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def summarize_text(paragraphs, limit=280):
    cleaned_parts = []
    for paragraph in paragraphs:
        text = " ".join(paragraph.split())
        if text:
            cleaned_parts.append(text)

    summary = " ".join(cleaned_parts).strip()
    if len(summary) <= limit:
        return summary

    truncated = summary[: limit - 3].rsplit(" ", 1)[0].strip()
    return f"{truncated}..."


def extract_article_details(html):
    soup = BeautifulSoup(html, "html.parser")
    details = {}

    body = soup.select_one(".article-body-disabled .field--name-field-content")
    if body:
        paragraphs = [node.get_text(" ", strip=True) for node in body.select("p")]
        summary = summarize_text(paragraphs[:2] or paragraphs[:1])
        if summary:
            details["summary"] = summary

    published_meta = soup.find("meta", attrs={"property": "article:published_time"})
    if published_meta and published_meta.get("content"):
        details["publishedAt"] = published_meta["content"].strip()

    return details


def parse_list_block(block, default_category):
    results = []
    for node in block.select(".item-list"):
        heading = node.find("h4")
        active_category = heading.get_text(" ", strip=True) if heading else default_category

        for item in node.select("li"):
            time_node = item.find("time")
            link_node = item.find("a", href=True)
            title = link_node.get_text(" ", strip=True) if link_node else ""
            link = urljoin(BASE_URL, link_node["href"]) if link_node else ""
            published_at = time_node.get("datetime", "").strip() if time_node else ""
            published_date = time_node.get_text(" ", strip=True) if time_node else ""

            if not title or not link:
                continue

            results.append(
                {
                    "name": title,
                    "category": active_category,
                    "section": default_category,
                    "publishedAt": published_at,
                    "publishedDate": published_date,
                    "link": link,
                }
            )

    return results


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []
    views = soup.select(".view-unlv-today-2018")

    for view in views:
        header = view.select_one(".view-header h3")
        section_title = header.get_text(" ", strip=True) if header else "UNLV Today"
        if section_title not in {"Today's Announcements", "More from the Last Week"}:
            continue

        results.extend(parse_list_block(view.select_one(".view-content") or view, section_title))

    return results


def fetch_article_details(item):
    try:
        article_html = fetch_text(item["link"], timeout=10)
    except requests.RequestException:
        return item

    details = extract_article_details(article_html)
    return {**item, **details}


def scrape():
    listing_html = fetch_text(URL, timeout=20)
    results = parse_listing_page(listing_html)

    enriched = []
    with ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = [executor.submit(fetch_article_details, item) for item in results]
        for future in as_completed(futures):
            enriched.append(future.result())

    enriched.sort(key=lambda item: item.get("publishedAt", ""), reverse=True)
    return enriched


def to_public_items(items):
    normalized = []
    for item in items:
        normalized.append(
            {
                "name": item.get("name", ""),
                "category": item.get("category", ""),
                "section": item.get("section", ""),
                "publishedDate": parse_date(item.get("publishedDate", "")),
                "publishedAt": item.get("publishedAt", ""),
                "summary": item.get("summary", ""),
                "link": item.get("link", ""),
            }
        )
    return normalized


def main():
    parser = argparse.ArgumentParser(description="Export UNLV Today announcements as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write unlvtoday_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "unlvtoday_list.json", items)
        print(f"Wrote {len(items)} UNLV Today items to {Path(args.output_dir) / 'unlvtoday_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
