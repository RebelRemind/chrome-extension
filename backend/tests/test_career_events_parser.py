from webscraping.career_events import parse_listing_page, parse_next_page_url


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


def test_parse_next_page_url_extracts_pagination_link():
    html = """
    <nav class="pagination">
      <span class="page-numbers current">Page 1</span>
      <a class="page-numbers" href="https://careerlaunch.unlv.edu/events/page/2/">Page 2</a>
    </nav>
    """

    assert parse_next_page_url(html) == "https://careerlaunch.unlv.edu/events/page/2/"
