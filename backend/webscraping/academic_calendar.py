import re
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from database import BASE

CURRENT_URL = "https://www.unlv.edu/students/academic-calendar"
CATALOG_NAV_URL = "https://catalog.unlv.edu/content.php?catoid=50&navoid=15674"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}
MONTH_FORMATS = ("%b %d", "%B %d")
FULL_DATE_FORMATS = ("%A, %B %d, %Y", "%A, %b %d, %Y")
CATALOG_LINK_PATTERN = re.compile(r"Fall\s+\d{4}\s*-\s*Summer\s+\d{4}", re.I)


def parse_event_date(date_text, year):
    cleaned = " ".join((date_text or "").replace("-", " ").split())
    for date_format in MONTH_FORMATS:
        try:
            parsed = datetime.strptime(f"{cleaned} {year}", f"{date_format} %Y")
            return parsed
        except ValueError:
            continue
    return None


def parse_full_event_date(date_text):
    cleaned = " ".join((date_text or "").replace("\xa0", " ").split())
    for date_format in FULL_DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, date_format)
        except ValueError:
            continue
    return None


def fetch_soup(url):
    response = requests.get(url, headers=USER_AGENT, timeout=20)
    if response.status_code != 200:
        raise RuntimeError(f"Failed to access page: {url} ({response.status_code})")
    return BeautifulSoup(response.text, "html.parser")


def extract_event_lines(container):
    lines = []
    for item in container.stripped_strings:
        text = " ".join(item.split())
        if text:
            lines.append(text)
    return lines


def extract_events_from_current_page(soup):
    current_year = datetime.now().year
    previous_month = None
    results = []
    seen = set()

    for container in soup.select("div.view-content div.item-list > ul > li"):
        link = container.select_one("div.click-region-link a[href]")
        if link is None:
            continue

        title_node = container.select_one("div.description div.title-text")
        title = " ".join(
            (title_node.get_text(" ", strip=True) if title_node else link.get_text(" ", strip=True)).split()
        )
        if not title:
            continue

        month_node = container.select_one("div.event-date span.event-month")
        day_node = container.select_one("div.event-date span.event-day")
        date_text = None
        if month_node and day_node:
            date_text = f"{month_node.get_text(strip=True)} {day_node.get_text(strip=True)}"

        if not date_text:
            lines = extract_event_lines(container)
            for index, line in enumerate(lines[:-1]):
                candidate = f"{line} {lines[index + 1]}"
                if parse_event_date(candidate, current_year) is not None:
                    date_text = candidate
                    break

        if not date_text:
            continue

        event_date = parse_event_date(date_text, current_year)
        if event_date is None:
            continue

        if previous_month is not None and event_date.month < previous_month:
            current_year += 1
            event_date = parse_event_date(date_text, current_year)
            if event_date is None:
                continue

        previous_month = event_date.month
        formatted_date = event_date.strftime("%A, %B %d, %Y")
        dedupe_key = (title, formatted_date)
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        results.append(
            {
                "name": title,
                "startDate": formatted_date,
                "endDate": formatted_date,
                "link": urljoin(CURRENT_URL, link.get("href", "")),
            }
        )

    return results


def extract_events_from_catalog_page(soup, source_url):
    results = []
    seen = set()

    for heading in soup.find_all("strong"):
        heading_text = heading.get_text(" ", strip=True)
        if not re.search(r"(Fall|Spring|Summer|Winter)\s+20\d{2}", heading_text):
            continue

        paragraph = heading.find_parent("p")
        if paragraph is None:
            continue

        table = paragraph.find_next_sibling("table")
        if table is None:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            raw_date = " ".join(cells[0].stripped_strings)
            raw_title = " ".join(cells[1].stripped_strings)
            event_date = parse_full_event_date(raw_date)
            title = " ".join(raw_title.split())

            if event_date is None or not title:
                continue

            formatted_date = event_date.strftime("%A, %B %d, %Y")
            dedupe_key = (title, formatted_date)
            if dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            results.append(
                {
                    "name": title,
                    "startDate": formatted_date,
                    "endDate": formatted_date,
                    "link": source_url,
                }
            )

    return results


def discover_catalog_calendar_urls(soup, limit=2):
    target_block = None
    for paragraph in soup.find_all("p"):
        text = " ".join(paragraph.get_text(" ", strip=True).split())
        if "Select the desired catalog" in text:
            target_block = paragraph.find_next_sibling("ul")
            break

    search_root = target_block or soup
    urls = []
    seen = set()

    for link in search_root.find_all("a", href=True):
        text = " ".join(link.get_text(" ", strip=True).split())
        if not CATALOG_LINK_PATTERN.search(text):
            continue

        href = urljoin(CATALOG_NAV_URL, link.get("href", ""))
        if href in seen:
            continue
        seen.add(href)
        urls.append(href)

        if len(urls) >= limit:
            break

    return urls


def merge_academic_calendar_events(current_events, catalog_events):
    merged = {}

    for event in catalog_events:
        merged[(event["name"], event["startDate"])] = event

    for event in current_events:
        merged[(event["name"], event["startDate"])] = event

    return sorted(
        merged.values(),
        key=lambda event: parse_full_event_date(event["startDate"]) or datetime.max,
    )


def scrape():
    current_soup = fetch_soup(CURRENT_URL)
    catalog_nav_soup = fetch_soup(CATALOG_NAV_URL)

    current_events = extract_events_from_current_page(current_soup)
    catalog_urls = discover_catalog_calendar_urls(catalog_nav_soup, limit=2)
    if not catalog_urls:
        raise RuntimeError("Failed to discover academic calendar catalog URLs")

    catalog_events = []
    for catalog_url in catalog_urls:
        catalog_soup = fetch_soup(catalog_url)
        catalog_events.extend(extract_events_from_catalog_page(catalog_soup, catalog_url))

    return merge_academic_calendar_events(current_events, catalog_events)


def default():
    results = scrape()
    for event in results:
        requests.put(BASE + "academiccalendar_add", json=event)


if __name__ == '__main__':
    default()
