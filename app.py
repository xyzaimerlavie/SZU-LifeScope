import json
import math
import sqlite3
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from config import get_setting


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "poi_seed.json"
DB_FILE = BASE_DIR / "data" / "life_circle.db"

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

CENTER = {
    "name": "深圳大学粤海校区",
    "lng": 113.936577,
    "lat": 22.532641,
    "address": "深圳市南山区南海大道3688号",
}

DORMS = {
    "ziwei": {
        "id": "ziwei",
        "name": "斋区",
        "lng": 113.939387,
        "lat": 22.533923,
        "address": "深圳大学粤海校区紫薇斋",
    },
    "qiaoxiang": {
        "id": "qiaoxiang",
        "name": "西南",
        "lng": 113.934050,
        "lat": 22.527449,
        "address": "深圳大学粤海校区乔相阁",
    },
    "xiazheng": {
        "id": "xiazheng",
        "name": "南区",
        "lng": 113.942157,
        "lat": 22.530649,
        "address": "深圳大学粤海校区夏筝",
    },
}

CAMPUS_ANCHORS = [
    {"name": "校园中心", "lng": CENTER["lng"], "lat": CENTER["lat"]},
    {"name": "紫薇斋", "lng": DORMS["ziwei"]["lng"], "lat": DORMS["ziwei"]["lat"]},
    {"name": "乔相阁", "lng": DORMS["qiaoxiang"]["lng"], "lat": DORMS["qiaoxiang"]["lat"]},
    {"name": "夏筝", "lng": DORMS["xiazheng"]["lng"], "lat": DORMS["xiazheng"]["lat"]},
    {"name": "深大北门", "lng": 113.934800, "lat": 22.544500},
    {"name": "粤海门", "lng": 113.942900, "lat": 22.533000},
]

COLLECTION_ANCHORS = [
    {"name": "紫薇斋生活区", "lng": DORMS["ziwei"]["lng"], "lat": DORMS["ziwei"]["lat"]},
    {"name": "乔相阁生活区", "lng": DORMS["qiaoxiang"]["lng"], "lat": DORMS["qiaoxiang"]["lat"]},
    {"name": "夏筝生活区", "lng": DORMS["xiazheng"]["lng"], "lat": DORMS["xiazheng"]["lat"]},
    {"name": "粤海校区中心", "lng": CENTER["lng"], "lat": CENTER["lat"]},
    {"name": "桂庙西南侧", "lng": 113.932200, "lat": 22.531900},
    {"name": "南山书城西侧", "lng": 113.925400, "lat": 22.532800},
    {"name": "深圳湾东南侧", "lng": 113.947400, "lat": 22.526800},
    {"name": "深大北门", "lng": 113.934800, "lat": 22.544500},
    {"name": "粤海门东侧", "lng": 113.942900, "lat": 22.533000},
]

COLLECTION_ANCHORS.extend(
    [
        {"name": "nanshan-book-mall", "lng": 113.924000, "lat": 22.532700},
        {"name": "guimiao-village", "lng": 113.930200, "lat": 22.527900},
        {"name": "shenda-metro", "lng": 113.932900, "lat": 22.540200},
        {"name": "coastal-city", "lng": 113.934800, "lat": 22.516900},
        {"name": "software-park", "lng": 113.946300, "lat": 22.536000},
    ]
)

CATEGORIES = {
    "food": {
        "label": "餐饮",
        "color": "#e85d3f",
        "amap_type": "050000",
    },
    "transport": {
        "label": "交通",
        "color": "#2f80ed",
        "amap_type": "150000",
    },
    "medical": {
        "label": "医疗",
        "color": "#0f9d7a",
        "amap_type": "090000",
    },
    "shopping": {
        "label": "购物",
        "color": "#d69b13",
        "amap_type": "060000",
    },
    "leisure": {
        "label": "休闲",
        "color": "#7b61c9",
        "amap_type": "080000|110000",
    },
}

DEFAULT_DORM_ID = "ziwei"
DEFAULT_WALK_MINUTES = 30
WALKING_SPEED_M_PER_MIN = 75
ROUTE_PRECOMPUTE_PER_CATEGORY = 2
AMAP_ROUTE_INTERVAL_SECONDS = 0.38
AMAP_POI_SEARCH_PAGES = 2
AMAP_POI_RADIUS_MAX = 4000
WALK_ROUTE_CACHE = {}


def load_seed_pois():
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_database():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pois (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                address TEXT NOT NULL,
                lng REAL NOT NULL,
                lat REAL NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS data_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                description TEXT NOT NULL,
                collected_at TEXT NOT NULL,
                record_count INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS walking_routes (
                origin_id TEXT NOT NULL,
                poi_id TEXT NOT NULL,
                distance REAL NOT NULL,
                duration REAL NOT NULL,
                route_path TEXT NOT NULL,
                collected_at TEXT NOT NULL,
                PRIMARY KEY (origin_id, poi_id)
            )
            """
        )
        seed_pois = load_seed_pois()
        seed_ids = [poi["id"] for poi in seed_pois]
        conn.executemany(
            """
            INSERT OR REPLACE INTO pois (id, name, category, address, lng, lat, source)
            VALUES (:id, :name, :category, :address, :lng, :lat, :source)
            """,
            seed_pois,
        )
        placeholders = ",".join("?" for _ in seed_ids)
        conn.execute(
            f"DELETE FROM pois WHERE source = 'seed' AND id NOT IN ({placeholders})",
            seed_ids,
        )
        conn.commit()


def load_db_pois(source="seed"):
    ensure_database()
    if source not in {"seed", "amap"}:
        source = "seed"
    with get_db_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM pois WHERE source = ?", (source,)).fetchone()[0]
        if count == 0 and source == "amap":
            source = "seed"
        rows = load_poi_rows(conn, source)
        pois = [dict(row) for row in rows]
    return pois


def load_poi_rows(conn, source):
    return conn.execute(
        """
        SELECT id, name, category, address, lng, lat, source
        FROM pois
        WHERE source = ?
        ORDER BY category, name
        """,
        (source,),
    ).fetchall()


def has_amap_pois():
    ensure_database()
    with get_db_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM pois WHERE source = 'amap'").fetchone()[0] > 0


def haversine_meters(lng1, lat1, lng2, lat2):
    radius = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_dorm(dorm_id):
    return DORMS.get(dorm_id, DORMS[DEFAULT_DORM_ID])


def estimate_walking_metric(origin, poi):
    line_distance = haversine_meters(origin["lng"], origin["lat"], poi["lng"], poi["lat"])
    walk_distance = max(line_distance, line_distance * 1.25)
    duration = walk_distance / WALKING_SPEED_M_PER_MIN * 60
    return {
        "distance": round(walk_distance),
        "walkDistance": round(walk_distance),
        "walkDuration": round(duration),
        "walkMinutes": max(1, math.ceil(duration / 60)),
        "lineDistance": round(line_distance),
        "routeMode": "estimate",
        "routePath": [],
    }


def build_cached_walking_metric(row):
    route_path = [point for point in row["route_path"].split(";") if "," in point]
    return {
        "distance": round(row["distance"]),
        "walkDistance": round(row["distance"]),
        "walkDuration": round(row["duration"]),
        "walkMinutes": max(1, math.ceil(row["duration"] / 60)),
        "routeMode": "amap",
        "routePath": route_path,
    }


def load_cached_walking(origin_id, poi_id):
    ensure_database()
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT distance, duration, route_path
            FROM walking_routes
            WHERE origin_id = ? AND poi_id = ?
            """,
            (origin_id, poi_id),
        ).fetchone()
    if not row:
        return None
    return build_cached_walking_metric(row)


def load_cached_walking_routes(origin_id, poi_ids):
    ids = list(dict.fromkeys(poi_ids))
    if not ids:
        return {}

    ensure_database()
    metrics = {}
    chunk_size = 800
    with get_db_connection() as conn:
        for index in range(0, len(ids), chunk_size):
            chunk = ids[index : index + chunk_size]
            placeholders = ",".join("?" for _ in chunk)
            rows = conn.execute(
                f"""
                SELECT poi_id, distance, duration, route_path
                FROM walking_routes
                WHERE origin_id = ? AND poi_id IN ({placeholders})
                """,
                [origin_id, *chunk],
            ).fetchall()
            for row in rows:
                metrics[row["poi_id"]] = build_cached_walking_metric(row)
    return metrics


def query_amap_walking(origin, poi):
    web_key = get_setting("AMAP_WEB_KEY") or get_setting("AMAP_KEY")
    if not web_key:
        return None

    cache_key = (
        round(origin["lng"], 6),
        round(origin["lat"], 6),
        round(poi["lng"], 6),
        round(poi["lat"], 6),
    )
    if cache_key in WALK_ROUTE_CACHE:
        return WALK_ROUTE_CACHE[cache_key]

    params = urllib.parse.urlencode(
        {
            "key": web_key,
            "origin": f"{origin['lng']:.6f},{origin['lat']:.6f}",
            "destination": f"{poi['lng']:.6f},{poi['lat']:.6f}",
            "output": "json",
        }
    )
    url = f"https://restapi.amap.com/v3/direction/walking?{params}"
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    if payload.get("status") != "1":
        return None

    paths = payload.get("route", {}).get("paths", [])
    if not paths:
        return None

    path = paths[0]
    steps = path.get("steps", [])
    route_path = []
    for step in steps:
        polyline = step.get("polyline") or ""
        route_path.extend([point for point in polyline.split(";") if "," in point])

    try:
        distance = float(path.get("distance", 0))
        duration = float(path.get("duration", 0))
    except (TypeError, ValueError):
        return None

    metric = {
        "distance": round(distance),
        "walkDistance": round(distance),
        "walkDuration": round(duration),
        "walkMinutes": max(1, math.ceil(duration / 60)) if duration else 0,
        "lineDistance": round(haversine_meters(origin["lng"], origin["lat"], poi["lng"], poi["lat"])),
        "routeMode": "amap",
        "routePath": route_path,
    }
    WALK_ROUTE_CACHE[cache_key] = metric
    return metric


def enrich_pois(
    pois,
    origin,
    use_amap_routes=False,
    require_amap_routes=False,
    cached_routes=None,
):
    enriched = []
    for poi in pois:
        route_metric = None
        if use_amap_routes:
            if cached_routes is None:
                route_metric = load_cached_walking(origin["id"], poi["id"])
            else:
                route_metric = cached_routes.get(poi["id"])
            if route_metric is None and require_amap_routes:
                continue
        if route_metric is None:
            route_metric = estimate_walking_metric(origin, poi)
        route_metric["lineDistance"] = round(
            haversine_meters(origin["lng"], origin["lat"], poi["lng"], poi["lat"])
        )
        enriched.append(
            {
                **poi,
                **route_metric,
                "centerDistance": round(haversine_meters(origin["lng"], origin["lat"], poi["lng"], poi["lat"])),
                "categoryLabel": CATEGORIES[poi["category"]]["label"],
                "color": CATEGORIES[poi["category"]]["color"],
            }
        )
    return enriched


def filter_pois(pois, max_minutes, categories, origin, use_amap_routes=False, require_amap_routes=False):
    selected = set(categories) if categories else set(CATEGORIES.keys())
    max_seconds = max_minutes * 60
    max_line_distance = max_minutes * WALKING_SPEED_M_PER_MIN * 1.55
    prefiltered = [
        poi
        for poi in pois
        if poi["category"] in selected
        and haversine_meters(origin["lng"], origin["lat"], poi["lng"], poi["lat"]) <= max_line_distance
    ]
    cached_routes = None
    if use_amap_routes:
        cached_routes = load_cached_walking_routes(origin["id"], [poi["id"] for poi in prefiltered])
    return [
        poi
        for poi in enrich_pois(
            prefiltered,
            origin,
            use_amap_routes,
            require_amap_routes,
            cached_routes,
        )
        if poi["walkDuration"] <= max_seconds and poi["category"] in selected
    ]


def summarize(pois, max_minutes, categories=None, score_pois=None):
    selected = categories or list(CATEGORIES.keys())
    score_pois = score_pois if score_pois is not None else pois
    by_category = []
    for key in selected:
        meta = CATEGORIES[key]
        items = [poi for poi in pois if poi["category"] == key]
        avg_distance = round(sum(p["walkDistance"] for p in items) / len(items)) if items else 0
        avg_minutes = round(sum(p["walkDuration"] for p in items) / len(items) / 60, 1) if items else 0
        by_category.append(
            {
                "key": key,
                "label": meta["label"],
                "count": len(items),
                "avgDistance": avg_distance,
                "avgMinutes": avg_minutes,
                "color": meta["color"],
            }
        )

    rings = []
    step = 10 if max_minutes > 20 else 5
    previous = 0
    for edge in range(step, max_minutes + step, step):
        edge = min(edge, max_minutes)
        lower = previous * 60
        upper = edge * 60
        count = len([poi for poi in pois if lower < poi["walkDuration"] <= upper])
        rings.append(
            {
                "label": f"{previous}-{edge}min",
                "count": count,
            }
        )
        if edge >= max_minutes:
            break
        previous = edge

    score_weights = {
        "food": 0.25,
        "transport": 0.20,
        "medical": 0.20,
        "shopping": 0.15,
        "leisure": 0.20,
    }
    convenience = 0
    radar = []
    for item in by_category:
        category_pois = [poi for poi in score_pois if poi["category"] == item["key"]]
        accessibility = sum(
            1 / (1 + (poi["walkDuration"] / 60))
            for poi in category_pois
        )
        score = 100 * (1 - math.exp(-accessibility / 6))
        score = round(score)
        radar.append({"label": item["label"], "score": score})
        convenience += score * score_weights[item["key"]]

    return {
        "total": len(pois),
        "minutes": max_minutes,
        "searchRadius": round(max_minutes * WALKING_SPEED_M_PER_MIN * 1.25),
        "byCategory": by_category,
        "rings": rings,
        "radar": radar,
        "convenienceScore": round(convenience),
        "routeMode": "amap" if any(poi.get("routeMode") == "amap" for poi in pois) else "estimate",
    }


def is_in_any_dorm_life_circle(poi, max_line_distance):
    return any(
        haversine_meters(dorm["lng"], dorm["lat"], poi["lng"], poi["lat"]) <= max_line_distance
        for dorm in DORMS.values()
    )


def query_amap_pois(radius, categories, origins, pages=1):
    web_key = get_setting("AMAP_WEB_KEY") or get_setting("AMAP_KEY")
    if not web_key:
        raise RuntimeError("缺少 AMAP_WEB_KEY，无法刷新高德数据")

    selected = categories or list(CATEGORIES.keys())
    search_origins = origins if isinstance(origins, list) else [origins]
    all_pois = []
    seen = set()
    errors = []
    for category in selected:
        amap_type = CATEGORIES[category]["amap_type"]
        for anchor in search_origins:
            for page in range(1, pages + 1):
                params = urllib.parse.urlencode(
                    {
                        "key": web_key,
                        "location": f"{anchor['lng']},{anchor['lat']}",
                        "radius": radius,
                        "types": amap_type,
                        "offset": 20,
                        "page": page,
                        "extensions": "base",
                        "output": "json",
                    }
                )
                url = f"https://restapi.amap.com/v3/place/around?{params}"
                payload = None
                for attempt in range(2):
                    try:
                        with urllib.request.urlopen(url, timeout=8) as response:
                            payload = json.loads(response.read().decode("utf-8"))
                        break
                    except Exception as exc:
                        if attempt == 1:
                            errors.append(f"{anchor['name']} {category} p{page}: {exc}")
                        time.sleep(0.25)
                if payload is None:
                    break
                if payload.get("status") != "1":
                    message = payload.get("info") or "unknown"
                    errors.append(f"{anchor['name']} {category} p{page}: {message}")
                    break
                items = payload.get("pois", [])
                if not items:
                    break
                for item in items:
                    if "," not in item.get("location", ""):
                        continue
                    raw_id = item.get("id") or f"amap-{category}-{len(all_pois)}"
                    poi_id = f"{category}-{raw_id}"
                    if poi_id in seen:
                        continue
                    seen.add(poi_id)
                    lng, lat = item["location"].split(",", 1)
                    all_pois.append(
                        {
                            "id": poi_id,
                            "name": item.get("name", "未命名地点"),
                            "category": category,
                            "address": item.get("address") or "暂无地址",
                            "lng": float(lng),
                            "lat": float(lat),
                            "source": "amap",
                        }
                    )
                time.sleep(0.03)
    if not all_pois:
        detail = "；".join(errors[:3]) if errors else "没有返回 POI"
        raise RuntimeError(f"高德 POI 请求没有采到有效数据：{detail}")
    return all_pois


def save_amap_dataset(pois):
    ensure_database()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM pois WHERE source = 'amap'")
        conn.executemany(
            """
            INSERT OR REPLACE INTO pois (id, name, category, address, lng, lat, source)
            VALUES (:id, :name, :category, :address, :lng, :lat, :source)
            """,
            pois,
        )
        conn.execute(
            """
            DELETE FROM walking_routes
            WHERE poi_id NOT IN (SELECT id FROM pois)
            """
        )
        conn.commit()
    WALK_ROUTE_CACHE.clear()


def save_refresh_record(radius, poi_count, route_count):
    ensure_database()
    collected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_sources (source, description, collected_at, record_count)
            VALUES (?, ?, ?, ?)
            """,
            (
                "amap",
                f"高德 POI 多锚点采集 + 步行路径预计算，锚点：{len(COLLECTION_ANCHORS)}个，半径：{radius}m，路线：{route_count}条",
                collected_at,
                poi_count,
            ),
        )
        conn.commit()


def save_walking_route(origin_id, poi_id, metric):
    ensure_database()
    collected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    route_path = ";".join(metric.get("routePath", []))
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO walking_routes
            (origin_id, poi_id, distance, duration, route_path, collected_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                origin_id,
                poi_id,
                metric["walkDistance"],
                metric["walkDuration"],
                route_path,
                collected_at,
            ),
        )
        conn.commit()


def route_cache_key_set():
    ensure_database()
    with get_db_connection() as conn:
        rows = conn.execute("SELECT origin_id, poi_id FROM walking_routes").fetchall()
    return {(row["origin_id"], row["poi_id"]) for row in rows}


def missing_route_jobs(minutes):
    max_line_distance = minutes * WALKING_SPEED_M_PER_MIN * 1.55
    pois = load_db_pois("amap")
    cached = route_cache_key_set()
    dorm_jobs = []
    for dorm in DORMS.values():
        jobs = []
        for poi in pois:
            if (dorm["id"], poi["id"]) in cached:
                continue
            if haversine_meters(dorm["lng"], dorm["lat"], poi["lng"], poi["lat"]) > max_line_distance:
                continue
            jobs.append((dorm, poi))
        jobs.sort(
            key=lambda item: (
                item[1]["category"],
                haversine_meters(item[0]["lng"], item[0]["lat"], item[1]["lng"], item[1]["lat"]),
            )
        )
        dorm_jobs.append(jobs)

    interleaved = []
    max_len = max((len(jobs) for jobs in dorm_jobs), default=0)
    for index in range(max_len):
        for jobs in dorm_jobs:
            if index < len(jobs):
                interleaved.append(jobs[index])
    return interleaved


def complete_walking_routes(minutes, max_jobs=None):
    jobs = missing_route_jobs(minutes)
    if max_jobs is not None:
        jobs = jobs[:max_jobs]
    success = 0
    failed = 0
    for dorm, poi in jobs:
        metric = query_amap_walking(dorm, poi)
        if metric is None:
            failed += 1
        else:
            save_walking_route(dorm["id"], poi["id"], metric)
            success += 1
        time.sleep(AMAP_ROUTE_INTERVAL_SECONDS)
    return {
        "attempted": len(jobs),
        "success": success,
        "failed": failed,
        "remaining": len(missing_route_jobs(minutes)),
    }


def refresh_amap_dataset(minutes):
    categories = list(CATEGORIES.keys())
    max_line_distance = minutes * WALKING_SPEED_M_PER_MIN * 1.55
    radius = max(1800, min(round(max_line_distance), AMAP_POI_RADIUS_MAX))
    dorms = list(DORMS.values())
    raw_pois = query_amap_pois(radius, categories, COLLECTION_ANCHORS, pages=AMAP_POI_SEARCH_PAGES)
    pois = [
        poi
        for poi in raw_pois
        if is_in_any_dorm_life_circle(poi, max_line_distance)
    ]
    save_amap_dataset(pois)

    route_count = 0
    for dorm in dorms:
        route_candidates = []
        for category in categories:
            category_pois = [
                poi
                for poi in pois
                if poi["category"] == category
                and haversine_meters(dorm["lng"], dorm["lat"], poi["lng"], poi["lat"]) <= max_line_distance
            ]
            category_pois.sort(
                key=lambda poi: haversine_meters(dorm["lng"], dorm["lat"], poi["lng"], poi["lat"])
            )
            route_candidates.extend(category_pois[:ROUTE_PRECOMPUTE_PER_CATEGORY])

        for poi in route_candidates:
            metric = query_amap_walking(dorm, poi)
            if metric is None:
                continue
            save_walking_route(dorm["id"], poi["id"], metric)
            route_count += 1
            time.sleep(AMAP_ROUTE_INTERVAL_SECONDS)

    save_refresh_record(radius, len(pois), route_count)
    return {
        "recordCount": len(pois),
        "routeCount": route_count,
        "radius": radius,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/config")
def config():
    return jsonify(
        {
            "center": CENTER,
            "dorms": list(DORMS.values()),
            "defaultDormId": DEFAULT_DORM_ID,
            "defaultWalkMinutes": DEFAULT_WALK_MINUTES,
            "campusAnchors": CAMPUS_ANCHORS,
            "categories": CATEGORIES,
            "amapJsKey": get_setting("AMAP_JS_KEY"),
            "amapSecurityCode": get_setting("AMAP_SECURITY_CODE"),
        }
    )


@app.route("/api/db/info")
def db_info():
    ensure_database()
    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM pois").fetchone()[0]
        by_category = conn.execute(
            """
            SELECT category, COUNT(*) AS count
            FROM pois
            GROUP BY category
            ORDER BY category
            """
        ).fetchall()
        sources = conn.execute(
            """
            SELECT source, description, collected_at, record_count
            FROM data_sources
            ORDER BY id DESC
            LIMIT 5
            """
        ).fetchall()
    return jsonify(
        {
            "database": str(DB_FILE.name),
            "total": total,
            "byCategory": [dict(row) for row in by_category],
            "sources": [dict(row) for row in sources],
        }
    )


@app.route("/api/pois")
def pois():
    minutes = int(request.args.get("minutes", DEFAULT_WALK_MINUTES))
    minutes = max(5, min(minutes, 60))
    categories_arg = request.args.get("categories", "")
    categories = [item for item in categories_arg.split(",") if item in CATEGORIES]
    dorm = get_dorm(request.args.get("dorm", DEFAULT_DORM_ID))

    if has_amap_pois():
        raw_pois = load_db_pois("amap")
        source = "amap_saved"
        use_amap_routes = True
        require_amap_routes = True
    else:
        raw_pois = load_db_pois("seed")
        source = "sample"
        use_amap_routes = False
        require_amap_routes = False

    filtered = filter_pois(raw_pois, minutes, categories, dorm, use_amap_routes, require_amap_routes)
    score_filtered = (
        filtered
        if minutes == DEFAULT_WALK_MINUTES
        else filter_pois(raw_pois, DEFAULT_WALK_MINUTES, categories, dorm, use_amap_routes, require_amap_routes)
    )
    return jsonify(
        {
            "source": source,
            "center": dorm,
            "pois": filtered,
            "stats": summarize(filtered, minutes, categories, score_filtered),
        }
    )


@app.route("/api/refresh-amap", methods=["POST"])
def refresh_amap():
    payload = request.get_json(silent=True) or {}
    minutes = int(payload.get("minutes", DEFAULT_WALK_MINUTES))
    minutes = max(10, min(minutes, 45))
    try:
        result = refresh_amap_dataset(minutes)
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 502
    return jsonify({"ok": True, **result})


@app.route("/api/complete-routes", methods=["POST"])
def complete_routes():
    payload = request.get_json(silent=True) or {}
    minutes = int(payload.get("minutes", DEFAULT_WALK_MINUTES))
    minutes = max(10, min(minutes, 45))
    max_jobs = payload.get("maxJobs")
    if max_jobs is not None:
        max_jobs = max(1, min(int(max_jobs), 5000))
    try:
        result = complete_walking_routes(minutes, max_jobs)
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 502
    return jsonify({"ok": True, **result})


@app.route("/api/stats")
def stats():
    minutes = int(request.args.get("minutes", DEFAULT_WALK_MINUTES))
    minutes = max(5, min(minutes, 60))
    categories_arg = request.args.get("categories", "")
    categories = [item for item in categories_arg.split(",") if item in CATEGORIES]
    dorm = get_dorm(request.args.get("dorm", DEFAULT_DORM_ID))
    if has_amap_pois():
        raw_pois = load_db_pois("amap")
        filtered = filter_pois(raw_pois, minutes, categories, dorm, True, True)
        score_filtered = (
            filtered
            if minutes == DEFAULT_WALK_MINUTES
            else filter_pois(raw_pois, DEFAULT_WALK_MINUTES, categories, dorm, True, True)
        )
    else:
        raw_pois = load_db_pois("seed")
        filtered = filter_pois(raw_pois, minutes, categories, dorm)
        score_filtered = (
            filtered
            if minutes == DEFAULT_WALK_MINUTES
            else filter_pois(raw_pois, DEFAULT_WALK_MINUTES, categories, dorm)
        )
    return jsonify(summarize(filtered, minutes, categories, score_filtered))


if __name__ == "__main__":
    ensure_database()
    app.run(debug=False, port=5000)
