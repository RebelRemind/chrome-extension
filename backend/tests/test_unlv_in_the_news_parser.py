from webscraping.unlv_in_the_news import parse_listing_page


def test_parse_listing_page_extracts_unlv_in_the_news_cards():
    html = """
    <div class="card bg-white views-row">
      <div class="card-block">
        <div class="click-region no-background">
          <div class="click-region-link">
            <a href="https://news3lv.com/news/example-story" target="_blank">Example Story Title</a>
          </div>
          <div class="pull-right">
            <img alt="K.S.N.V. T.V. News 3" src="/logo.png" />
          </div>
          <div class="details">
            <time datetime="2026-04-17T10:43:09-07:00">April 17, 2026</time>
          </div>
          <div><p>Example summary from the listing page.</p></div>
          <div class="padding-xs margin-top-sm bg-gray-50">
            <div class="click-region-link">
              <a href="/news/expert/erin-breen">Featured Expert: Erin Breen</a>
            </div>
          </div>
        </div>
      </div>
    </div>
    """

    result = parse_listing_page(html)

    assert len(result) == 1
    assert result[0]["name"] == "Example Story Title"
    assert result[0]["category"] == "K.S.N.V. T.V. News 3"
    assert result[0]["section"] == "In The News"
    assert result[0]["summary"] == "Example summary from the listing page."
    assert result[0]["link"] == "https://news3lv.com/news/example-story"
