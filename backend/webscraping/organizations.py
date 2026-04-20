import requests
import json
from database import BASE

URL = "https://involvementcenter.unlv.edu/api/discovery/search/organizations?"
QUERY = "orderBy%5B0%5D=UpperName%20asc&top=9999&filter=&query=&skip=0"
ORGANIZATION_URL = "https://involvementcenter.unlv.edu/organization/"
IMAGE_URL = "https://se-images.campuslabs.com/clink/images/"
USER_AGENT = {"User-Agent": "Mozilla/5.0"}
REQUEST_TIMEOUT = (5, 20)

def scrape():
    response = requests.get(URL + QUERY, headers=USER_AGENT, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    json_data = response.json()
    orgs = json_data['value']
    results = []
    for org in orgs:
        org = map_event(org)
        results.append(org)
    
    # with open('scraped_Organizations.json', 'w', encoding='utf-8') as f:
    #     json.dump(results, f, indent=4)
    return results

def default():
    results = scrape()
    # PUT events into database
    for org in results:
        requests.put(BASE + "organization_add", json=org)

def map_event(org_json):
    profile_picture = (org_json.get('ProfilePicture') or '').strip()
    website_key = (org_json.get('WebsiteKey') or '').strip()
    return {
        'name': org_json['Name'],
        'imageUrl': f"{IMAGE_URL}{profile_picture}?preset=small-sq" if profile_picture else "",
        'link': f"{ORGANIZATION_URL}{website_key}" if website_key else "",
    }

if __name__ == '__main__':
    default()
