import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime

from app import CATEGORIES, COLLECTION_ANCHORS, CENTER, ensure_database, get_db_connection
from config import get_setting


def request_amap_page(key, category, anchor, radius, page):
    params = urllib.parse.urlencode(
        {
            "key": key,
            "location": f"{anchor['lng']},{anchor['lat']}",
            "radius": radius,
            "types": CATEGORIES[category]["amap_type"],
            "offset": 25,
            "page": page,
            "extensions": "base",
            "output": "json",
        }
    )
    url = f"https://restapi.amap.com/v3/place/around?{params}"
    with urllib.request.urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("status") != "1":
        message = payload.get("info") or "unknown error"
        raise RuntimeError(f"AMap request failed: {message}")
    return payload.get("pois", [])


def fetch_pois(key, radius, pages):
    pois = []
    seen = set()
    for category in CATEGORIES:
        for anchor in COLLECTION_ANCHORS:
            for page in range(1, pages + 1):
                items = request_amap_page(key, category, anchor, radius, page)
                if not items:
                    break
                for item in items:
                    location = item.get("location", "")
                    if "," not in location:
                        continue
                    lng, lat = location.split(",", 1)
                    raw_id = item.get("id") or f"amap-{category}-{len(pois)}"
                    poi_id = f"{category}-{raw_id}"
                    if poi_id in seen:
                        continue
                    seen.add(poi_id)
                    pois.append(
                        {
                            "id": poi_id,
                            "name": item.get("name") or "未命名地点",
                            "category": category,
                            "address": item.get("address") or "暂无地址",
                            "lng": float(lng),
                            "lat": float(lat),
                            "source": "amap",
                        }
                    )
                time.sleep(0.12)
    return pois


def save_pois(pois, radius, replace_seed):
    ensure_database()
    collected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        conn.execute("DELETE FROM pois WHERE source = 'amap'")
        if replace_seed:
            conn.execute("DELETE FROM pois WHERE source = 'seed'")
        conn.executemany(
            """
            INSERT OR REPLACE INTO pois (id, name, category, address, lng, lat, source)
            VALUES (:id, :name, :category, :address, :lng, :lat, :source)
            """,
            pois,
        )
        conn.execute(
            """
            INSERT INTO data_sources (source, description, collected_at, record_count)
            VALUES (?, ?, ?, ?)
            """,
            (
                "amap",
                f"高德地图 Web服务 API 多锚点周边搜索，中心：{CENTER['name']}，锚点：{len(COLLECTION_ANCHORS)}个，半径：{radius}m",
                collected_at,
                len(pois),
            ),
        )
        conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Fetch real POI data from AMap into SQLite.")
    parser.add_argument("--radius", type=int, default=2000, help="Search radius in meters.")
    parser.add_argument("--pages", type=int, default=2, help="Pages per category.")
    parser.add_argument(
        "--replace-seed",
        action="store_true",
        help="Remove seed records so the database only contains AMap records.",
    )
    args = parser.parse_args()

    key = get_setting("AMAP_WEB_KEY") or get_setting("AMAP_KEY")
    if not key:
        raise SystemExit("Please set AMAP_WEB_KEY first.")

    pois = fetch_pois(key, args.radius, args.pages)
    save_pois(pois, args.radius, args.replace_seed)
    print(f"Fetched {len(pois)} AMap POIs into SQLite.")


if __name__ == "__main__":
    main()
