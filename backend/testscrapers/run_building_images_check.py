import json
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from webscraping.building_images import scrape as scrape_building_images
from webscraping.building_images import to_public_items as normalize_building_images


OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file_handle:
        json.dump(payload, file_handle, indent=2, ensure_ascii=True)
        file_handle.write("\n")


def main():
    print("Starting buildingimages scrape...", flush=True)
    items = normalize_building_images(scrape_building_images() or [])

    write_json(OUTPUT_DIR / "buildingimages_list.json", items)

    missing_image = [item for item in items if not item.get("image-link")]
    summary = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "dataset": "buildingimages",
        "status": "ok" if items and not missing_image else "warning",
        "totalItems": len(items),
        "missingImageLinks": len(missing_image),
        "sampleItems": items[:5],
        "file": "buildingimages_list.json",
    }
    write_json(OUTPUT_DIR / "buildingimages_summary.json", summary)

    print(
        f"Finished buildingimages: {summary['totalItems']} items, "
        f"{summary['missingImageLinks']} missing image links",
        flush=True,
    )


if __name__ == "__main__":
    main()
