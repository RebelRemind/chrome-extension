from webscraping.building_images import parse_building_title, parse_listing_page


def test_parse_building_title_splits_code_and_name():
    assert parse_building_title("LLB:  Lied Library") == ("LLB", "Lied Library")


def test_parse_listing_page_extracts_unlv_building_image_links():
    html = """
    <div class="card bg-white views-row">
      <img src="/sites/default/files/styles/large/public/media/image/2026-01/llb-D76280_009-2000x1333.jpg?itok=2-uMe_dt" />
      <h4 class="h6 clear-margin-top">LLB:  Lied Library</h4>
    </div>
    <div class="card bg-white views-row">
      <img src="/sites/default/files/styles/large/public/building_images/csn_charleston-building_m.jpg?itok=9Q5ap-ic" />
      <h4 class="h6 clear-margin-top">CSN Charleston Campus - Building M</h4>
    </div>
    """

    result = parse_listing_page(html)

    assert result == [
        {
            "bldg-code": "LLB",
            "bldg-name": "Lied Library",
            "image-link": "https://www.unlv.edu/sites/default/files/styles/large/public/media/image/2026-01/llb-D76280_009-2000x1333.jpg?itok=2-uMe_dt",
        }
    ]
