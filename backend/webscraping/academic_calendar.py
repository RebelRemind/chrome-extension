import requests
from datetime import datetime

from bs4 import BeautifulSoup
from database import BASE

URL = "https://www.unlv.edu/students/academic-calendar"
MONTH_FORMATS = ("%b %d", "%B %d")


def parse_event_date(date_text, year):
    cleaned = " ".join((date_text or "").replace("-", " ").split())
    for date_format in MONTH_FORMATS:
        try:
            parsed = datetime.strptime(f"{cleaned} {year}", f"{date_format} %Y")
            return parsed
        except ValueError:
            continue
    return None


def extract_event_lines(container):
    lines = []
    for item in container.stripped_strings:
        text = " ".join(item.split())
        if text:
            lines.append(text)
    return lines


def extract_events_from_page(soup):
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
        if previous_month is not None and event_date.month < previous_month:
            current_year += 1
            event_date = parse_event_date(date_text, current_year)

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
            }
        )

    return results

def scrape():
    """
    Extracts academic calendar events from the current UNLV students page.
    """
    response = requests.get(URL, headers={"User-Agent": "Mozilla/5.0"})
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "html.parser")
        return extract_events_from_page(soup)
    else:
        print(f"Failed to access the page. Status code: {response.status_code}")

def default():
    results = scrape()
    # PUT calendar events into the database
    for event in results:
        requests.put(BASE + "academiccalendar_add", json=event)

if __name__ == '__main__':
    default()
