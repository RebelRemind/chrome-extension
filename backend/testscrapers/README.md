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

To run just the UNLV Today source check:

```bash
python3 backend/testscrapers/run_unlv_today_check.py
```

That command writes:

- `backend/testscrapers/output/unlvtoday_list.json`
- `backend/testscrapers/output/unlvtoday_summary.json`
