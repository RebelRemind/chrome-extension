from webscraping.involvement_center import clean_description, map_event


def test_clean_description_strips_html_and_collapses_whitespace():
    html = """
    <p style="text-align: center;">Come by for <strong>free food</strong>, games, and prizes.</p>
    <p>Visit <a href="https://example.com">our website</a>.</p>
    """

    assert clean_description(html) == "Come by for free food, games, and prizes. Visit our website."


def test_map_event_includes_clean_description():
    event = {
        "id": "123",
        "name": "Club Night",
        "startsOn": "2026-01-26T18:00:00+00:00",
        "endsOn": "2026-01-26T19:30:00+00:00",
        "location": "Student Union",
        "organizationName": "Layer Zero",
        "imagePath": "",
        "description": "<p>Build projects with <strong>friends</strong>.</p>",
    }

    result = map_event(event)

    assert result["description"] == "Build projects with friends."
