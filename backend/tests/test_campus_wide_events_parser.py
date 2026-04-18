from webscraping.campus_wide_events import parse_listing_page


def test_parse_listing_page_extracts_campus_wide_events():
    html = """
    <div class="item-list">
      <ul>
        <li>
          <div class="click-region">
            <div class="click-region-link">
              <a href="/event/rebels-after-dark-20">
                <span class="date-display-single">Apr</span>
                <span class="date-display-single">23</span>
                : Rebels After Dark
              </a>
            </div>
            <div class="event-date">
              <span class="event-month">Apr</span>
              <span class="event-day">23</span>
            </div>
            <div class="description">
              <div class="event-title"><div class="title-text">Rebels After Dark</div></div>
              <p>Free food and activities for all UNLV students.</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
    """

    result = parse_listing_page(html)

    assert len(result) == 1
    assert result[0]["name"] == "Rebels After Dark"
    assert result[0]["category"] == "Campus-Wide Event"
    assert result[0]["section"] == "Campus-Wide Events"
    assert result[0]["summary"] == "Free food and activities for all UNLV students."
    assert result[0]["link"] == "https://www.unlv.edu/event/rebels-after-dark-20"
    assert result[0]["startDate"]
