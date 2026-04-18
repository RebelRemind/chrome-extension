from webscraping.career_events import parse_listing_page


def test_parse_listing_page_extracts_career_events():
    html = """
    <li class="event_item post type-event">
      <a href="https://careerlaunch.unlv.edu/events/2026/04/22/persuasive-presence-articulating-your-value-to-recruiters/">
        <div class="day_box">
          <span class="day_box_month">Apr</span>
          <span class="day_box_date">22</span>
        </div>
        <div class="text-content">
          <h3 class="title"><span class="screen-reader-text">Event:</span> Persuasive Presence: Articulating Your Value to Recruiters</h3>
          <div>
            <p class="event-date">Wednesday, April 22, 2026</p>
            <p class="event-time">12pm - 1pm PDT</p>
            <p class="event-location">Virtual</p>
          </div>
        </div>
      </a>
    </li>
    """

    result = parse_listing_page(html)

    assert len(result) == 1
    assert result[0]["name"] == "Persuasive Presence: Articulating Your Value to Recruiters"
    assert result[0]["category"] == "Career Event"
    assert result[0]["section"] == "Upcoming Career Events"
    assert result[0]["startDate"] == "2026-04-22"
    assert result[0]["location"] == "Virtual"
    assert "12pm - 1pm PDT" in result[0]["summary"]
