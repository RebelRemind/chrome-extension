# Scraper Verification

This folder is for quick live verification of scraper output without touching the main export workflow.

Run:

```bash
python3 backend/testscrapers/run_calendar_source_checks.py
```

That command writes:

- `backend/testscrapers/output/academiccalendar_list.json`
- `backend/testscrapers/output/unlvcalendar_list.json`
- `backend/testscrapers/output/rebelcoverage_list.json`
- `backend/testscrapers/output/summary.json`

`summary.json` includes basic counts for:

- total events
- events with end times
- events without end times
- a few sample events

To run just the academic calendar source check:

```bash
python3 backend/testscrapers/run_academic_calendar_check.py
```

To run just the building image source check:

```bash
python3 backend/testscrapers/run_building_images_check.py
```

That command writes:

- `backend/testscrapers/output/buildingimages_list.json`
- `backend/testscrapers/output/buildingimages_summary.json`

To run just the UNLV Today source check:

```bash
python3 backend/testscrapers/run_unlv_today_check.py
```

That command writes:

- `backend/testscrapers/output/unlvtoday_list.json`
- `backend/testscrapers/output/unlvtoday_summary.json`

To run just the UNLV In The News source check:

```bash
python3 backend/testscrapers/run_unlv_in_the_news_check.py
```

That command writes:

- `backend/testscrapers/output/unlvinthenews_list.json`
- `backend/testscrapers/output/unlvinthenews_summary.json`

To run just the Scarlet and Gray News source check:

```bash
python3 backend/testscrapers/run_scarlet_and_gray_news_check.py
```

That command writes:

- `backend/testscrapers/output/scarletandgraynews_list.json`
- `backend/testscrapers/output/scarletandgraynews_summary.json`

To run just the Campus-Wide Events source check:

```bash
python3 backend/testscrapers/run_campus_wide_events_check.py
```

That command writes:

- `backend/testscrapers/output/campuswideevents_list.json`
- `backend/testscrapers/output/campuswideevents_summary.json`

To run just the Career Events source check:

```bash
python3 backend/testscrapers/run_career_events_check.py
```

That command writes:

- `backend/testscrapers/output/careerevents_list.json`
- `backend/testscrapers/output/careerevents_summary.json`
