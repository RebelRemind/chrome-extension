import json
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from webscraping.scarlet_and_gray_news import scrape as scrape_scarlet_and_gray_news
from webscraping.scarlet_and_gray_news import to_public_items as normalize_scarlet_and_gray_news


OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def main():
    print("Starting scarletandgraynews scrape...", flush=True)
    items = normalize_scarlet_and_gray_news(scrape_scarlet_and_gray_news() or [])

    write_json(OUTPUT_DIR / "scarletandgraynews_list.json", items)

    with_summary = [item for item in items if item.get("summary")]
    without_summary = [item for item in items if not item.get("summary")]
    categories = sorted({item.get("category", "") for item in items if item.get("category")})
    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "dataset": "scarletandgraynews",
        "status": "ok",
        "totalItems": len(items),
        "withSummary": len(with_summary),
        "withoutSummary": len(without_summary),
        "categories": categories,
        "sampleItems": items[:5],
        "file": "scarletandgraynews_list.json",
    }
    write_json(OUTPUT_DIR / "scarletandgraynews_summary.json", summary)

    print(
        f"Finished scarletandgraynews: {summary['totalItems']} items, "
        f"{summary['withSummary']} with summary, "
        f"{summary['withoutSummary']} without summary",
        flush=True,
    )


if __name__ == "__main__":
    main()
