import json
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from export_pages_data import normalize_rebel_coverage, normalize_unlv_calendar
from webscraping.rebel_coverage import scrape as scrape_rebel_coverage
from webscraping.unlv_calendar import scrape as scrape_unlv_calendar


OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def build_summary(name, items):
    with_end_time = [item for item in items if item.get("endTime")]
    without_end_time = [item for item in items if not item.get("endTime")]

    return {
        "dataset": name,
        "status": "ok",
        "totalEvents": len(items),
        "withEndTime": len(with_end_time),
        "withoutEndTime": len(without_end_time),
        "sampleWithEndTime": with_end_time[:5],
        "sampleWithoutEndTime": without_end_time[:5],
    }


def run_dataset(name, scraper, normalizer, file_name):
    print(f"Starting {name} scrape...", flush=True)
    try:
        items = normalizer(scraper() or [])
    except Exception as exc:
        print(f"{name} failed: {exc}", flush=True)
        return {
            "dataset": name,
            "status": "error",
            "error": str(exc),
            "file": file_name,
            "totalEvents": 0,
            "withEndTime": 0,
            "withoutEndTime": 0,
            "sampleWithEndTime": [],
            "sampleWithoutEndTime": [],
        }

    write_json(OUTPUT_DIR / file_name, items)
    summary = build_summary(name, items)
    summary["file"] = file_name
    print(
        f"Finished {name}: {summary['totalEvents']} events, "
        f"{summary['withEndTime']} with endTime",
        flush=True,
    )
    return summary


def main():
    datasets = [
        run_dataset(
            "unlvcalendar",
            scrape_unlv_calendar,
            normalize_unlv_calendar,
            "unlvcalendar_list.json",
        ),
        run_dataset(
            "rebelcoverage",
            scrape_rebel_coverage,
            normalize_rebel_coverage,
            "rebelcoverage_list.json",
        ),
    ]

    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "datasets": datasets,
    }
    write_json(OUTPUT_DIR / "summary.json", summary)

    print(f"Wrote scraper verification files to {OUTPUT_DIR}")
    for dataset in summary["datasets"]:
        if dataset["status"] == "error":
            print(f"{dataset['dataset']}: error - {dataset['error']}")
            continue
        print(
            f"{dataset['dataset']}: {dataset['totalEvents']} events, "
            f"{dataset['withEndTime']} with endTime, "
            f"{dataset['withoutEndTime']} without endTime"
        )


if __name__ == "__main__":
    main()
