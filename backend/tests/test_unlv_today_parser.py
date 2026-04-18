from webscraping.unlv_today import extract_article_details, parse_listing_page


def test_parse_listing_page_collects_sections_and_categories():
    html = """
    <div class="view-unlv-today-2018">
      <div class="view-header"><h3>Today's Announcements</h3></div>
      <div class="view-content">
        <div class="item-list">
          <ul>
            <li>
              <div class="details"><time datetime="2026-04-17T07:33:41-07:00">April 17, 2026</time></div>
              <div><a href="/news/unlvtoday/needed-clark-county-2026-election-workers">Needed - Clark County 2026 Election Workers</a></div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="view-unlv-today-2018">
      <div class="view-header"><h3>More from the Last Week</h3></div>
      <div class="view-content">
        <div class="item-list">
          <h4>Announcements</h4>
          <ul>
            <li>
              <div class="details"><time datetime="2026-04-14T13:14:44-07:00">April 14, 2026</time></div>
              <div><a href="/news/unlvtoday/podcast-how-ai-can-improve-instructional-design">Podcast: How AI Can Improve Instructional Design</a></div>
            </li>
          </ul>
        </div>
        <div class="item-list">
          <h4>Parking, Facilities, and Safety</h4>
          <ul>
            <li>
              <div class="details"><time datetime="2026-04-13T08:15:00-07:00">April 13, 2026</time></div>
              <div><a href="/news/unlvtoday/fire-safety-protocol-reminder">Fire Safety Protocol Reminder</a></div>
            </li>
          </ul>
        </div>
      </div>
    </div>
    """

    results = parse_listing_page(html)

    assert [item["name"] for item in results] == [
        "Needed - Clark County 2026 Election Workers",
        "Podcast: How AI Can Improve Instructional Design",
        "Fire Safety Protocol Reminder",
    ]
    assert results[0]["section"] == "Today's Announcements"
    assert results[0]["category"] == "Today's Announcements"
    assert results[1]["section"] == "More from the Last Week"
    assert results[1]["category"] == "Announcements"
    assert results[2]["category"] == "Parking, Facilities, and Safety"
    assert results[2]["link"] == "https://www.unlv.edu/news/unlvtoday/fire-safety-protocol-reminder"


def test_extract_article_details_builds_summary_and_published_at():
    html = """
    <html>
      <head>
        <meta property="article:published_time" content="2026-04-16T16:34:49-0700" />
      </head>
      <body>
        <div class="article-body-disabled">
          <div class="field field--name-field-content">
            <p>Calling all UNLV Faculty and Staff!</p>
            <p>The Clark County Election Department is looking for election workers who will assist voters at the polls.</p>
            <p>Additional detail that should not be needed in the summary.</p>
          </div>
        </div>
      </body>
    </html>
    """

    result = extract_article_details(html)

    assert result["publishedAt"] == "2026-04-16T16:34:49-0700"
    assert "Calling all UNLV Faculty and Staff!" in result["summary"]
    assert "Clark County Election Department" in result["summary"]
