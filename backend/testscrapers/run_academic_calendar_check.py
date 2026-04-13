import json
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from export_pages_data import normalize_academic_calendar
from webscraping.academic_calendar import scrape as scrape_academic_calendar


OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def main():
    print("Starting academiccalendar scrape...", flush=True)
    items = normalize_academic_calendar(scrape_academic_calendar() or [])

    write_json(OUTPUT_DIR / "academiccalendar_list.json", items)

    linked_items = [item for item in items if item.get("link")]
    unlinked_items = [item for item in items if not item.get("link")]
    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "dataset": "academiccalendar",
        "status": "ok",
        "totalEvents": len(items),
        "withLink": len(linked_items),
        "withoutLink": len(unlinked_items),
        "sampleWithLink": linked_items[:5],
        "sampleWithoutLink": unlinked_items[:5],
        "file": "academiccalendar_list.json",
    }
    write_json(OUTPUT_DIR / "academiccalendar_summary.json", summary)

    print(
        f"Finished academiccalendar: {summary['totalEvents']} events, "
        f"{summary['withLink']} with link, "
        f"{summary['withoutLink']} without link",
        flush=True,
    )


if __name__ == "__main__":
    main()
