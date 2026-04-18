import json
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from webscraping.unlv_in_the_news import scrape as scrape_unlv_in_the_news
from webscraping.unlv_in_the_news import to_public_items as normalize_unlv_in_the_news


OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def main():
    print("Starting unlvinthenews scrape...", flush=True)
    items = normalize_unlv_in_the_news(scrape_unlv_in_the_news() or [])

    write_json(OUTPUT_DIR / "unlvinthenews_list.json", items)

    with_summary = [item for item in items if item.get("summary")]
    without_summary = [item for item in items if not item.get("summary")]
    categories = sorted({item.get("category", "") for item in items if item.get("category")})
    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "dataset": "unlvinthenews",
        "status": "ok",
        "totalItems": len(items),
        "withSummary": len(with_summary),
        "withoutSummary": len(without_summary),
        "categories": categories,
        "sampleItems": items[:5],
        "file": "unlvinthenews_list.json",
    }
    write_json(OUTPUT_DIR / "unlvinthenews_summary.json", summary)

    print(
        f"Finished unlvinthenews: {summary['totalItems']} items, "
        f"{summary['withSummary']} with summary, "
        f"{summary['withoutSummary']} without summary",
        flush=True,
    )


if __name__ == "__main__":
    main()
