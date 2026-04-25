import argparse
import json
import re
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.unlv.edu"
URL = f"{BASE_URL}/maps/buildings"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}


def parse_building_title(value):
    if not value:
        return "", ""

    match = re.match(r"^([A-Z0-9&-]+):\s*(.+)$", " ".join(value.split()))
    if not match:
        return "", ""

    return match.group(1), match.group(2)


def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for row in soup.select(".views-row"):
        title_node = row.select_one("h4")
        image_node = row.select_one("img[src]")

        building_code, building_name = parse_building_title(
            title_node.get_text(" ", strip=True) if title_node else ""
        )
        image_link = urljoin(BASE_URL, image_node.get("src", "").strip()) if image_node else ""

        if not building_code or not building_name or not image_link:
            continue

        results.append(
            {
                "bldg-code": building_code,
                "bldg-name": building_name,
                "image-link": image_link,
            }
        )

    return results


def to_public_items(items):
    return [
        {
            "bldg-code": item.get("bldg-code", ""),
            "bldg-name": item.get("bldg-name", ""),
            "image-link": item.get("image-link", ""),
        }
        for item in items
    ]


def write_json(output_dir, file_name, payload):
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / file_name).open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def scrape():
    response = requests.get(URL, headers=USER_AGENT, timeout=20)
    response.raise_for_status()
    return parse_listing_page(response.text)


def main():
    parser = argparse.ArgumentParser(description="Export UNLV building image links as public JSON.")
    parser.add_argument("--output-dir", help="Directory to write buildingimages_list.json into.")
    args = parser.parse_args()

    items = to_public_items(scrape())
    if args.output_dir:
        write_json(Path(args.output_dir), "buildingimages_list.json", items)
        print(f"Wrote {len(items)} building image links to {Path(args.output_dir) / 'buildingimages_list.json'}")
        return

    for item in items:
        print(item)


if __name__ == "__main__":
    main()
