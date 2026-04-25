from webscraping.scarlet_and_gray_news import parse_feed


def test_parse_feed_extracts_scarlet_and_gray_items():
    xml = """
    <rss version="2.0">
      <channel>
        <item>
          <title>Example Scarlet Story</title>
          <link>https://unlvscarletandgray.com/news/example-story/</link>
          <pubDate>Fri, 24 Apr 2026 07:15:00 +0000</pubDate>
          <category>News</category>
          <description><![CDATA[<p>Short preview text from Scarlet and Gray.</p>]]></description>
        </item>
      </channel>
    </rss>
    """

    result = parse_feed(xml)

    assert len(result) == 1
    assert result[0]["name"] == "Example Scarlet Story"
    assert result[0]["category"] == "News"
    assert result[0]["section"] == "Scarlet and Gray News"
    assert result[0]["publishedDate"] == "2026-04-24"
    assert result[0]["publishedAt"] == "2026-04-24T07:15:00+00:00"
    assert result[0]["summary"] == "Short preview text from Scarlet and Gray."
    assert result[0]["link"] == "https://unlvscarletandgray.com/news/example-story/"