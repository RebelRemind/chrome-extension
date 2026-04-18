from webscraping.scarlet_and_gray_news import parse_listing_page


def test_parse_listing_page_extracts_scarlet_and_gray_cards():
    html = """
    <div class="td-module-meta-info">
      <h3 class="entry-title td-module-title">
        <a href="https://unlvscarletandgray.com/news/example-story/" rel="bookmark">Example Scarlet Story</a>
      </h3>
      <div class="td-editor-date">
        <a class="td-post-category" href="https://unlvscarletandgray.com/category/news/">News</a>
        <span class="td-post-date">
          <time class="entry-date updated td-module-date" datetime="2026-04-15T00:10:00-07:00">April 15, 2026</time>
        </span>
      </div>
      <div class="td-excerpt">Short preview text from Scarlet and Gray.</div>
    </div>
    """

    result = parse_listing_page(html)

    assert len(result) == 1
    assert result[0]["name"] == "Example Scarlet Story"
    assert result[0]["category"] == "News"
    assert result[0]["section"] == "Scarlet and Gray News"
    assert result[0]["summary"] == "Short preview text from Scarlet and Gray."
    assert result[0]["link"] == "https://unlvscarletandgray.com/news/example-story/"
