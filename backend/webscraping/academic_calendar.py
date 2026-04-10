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

    for link in soup.select('main li a[href*="/students/academic-calendar"]'):
        container = link.find_parent("li")
        if container is None:
            continue

        if not link:
            continue

        title = " ".join(link.get_text(" ", strip=True).split())
        if not title:
            continue

        lines = extract_event_lines(container)
        date_text = next(
            (
                line for line in lines
                if parse_event_date(line, current_year) is not None
            ),
            None,
        )
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
