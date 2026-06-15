const state = {
  center: null,
  dorms: [],
  selectedDormId: null,
  campusAnchors: [],
  categories: {},
  selectedCategories: new Set(),
  minutes: 30,
  pois: [],
  stats: null,
  comparison: null,
  activePoiId: null,
  selectedNearestCategoryKey: null,
  selectedTimeRingIndex: null,
  selectedIntentKey: "",
  amap: null,
  amapMarkers: [],
  amapPoiMarkers: [],
  amapRangeOverlays: [],
  amapHeatmap: null,
  amapHeatmapPromise: null,
  hasFitAmap: false,
  useAmap: false,
  amapDrag: null,
  fallbackPan: { x: 0, y: 0 },
  fallbackDrag: null,
  charts: {
    category: null,
    ring: null,
    radar: null,
    comparison: null,
  },
};

const AMAP_MARKER_ZOOM_THRESHOLD = 16;

const INTENT_OPTIONS = {
  chess: {
    label: "棋牌",
    categories: ["leisure"],
    keywords: ["棋牌", "麻将", "桌游", "娱乐"],
  },
  ktv: {
    label: "KTV",
    categories: ["leisure"],
    keywords: ["ktv"],
    nameOnly: true,
  },
  food: {
    label: "吃饭",
    categories: ["food"],
    keywords: ["餐厅", "饭", "菜", "粉", "面", "火锅", "烧烤", "烤肉", "小炒", "酒家", "食堂", "饺子", "汉堡", "披萨", "粥", "米粉", "拉面", "快餐", "小馆"],
    excludeKeywords: ["咖啡", "coffee", "cafe", "奶茶", "茶饮", "饮品", "星巴克", "瑞幸", "库迪", "manner", "奈雪", "喜茶", "霸王茶姬", "益禾堂", "茶百道", "1点点", "蜜雪", "冰淇淋", "蛋糕"],
  },
  hospital: {
    label: "医院",
    categories: ["medical"],
    keywords: ["校医院", "大学医院", "人民医院", "南山医院", "综合医院", "医院"],
    excludeKeywords: ["公交站", "停车场", "诊所", "门诊", "药房", "药店", "口腔", "医疗美容", "心理", "器械", "公司", "中心", "整形美容科", "心电图室", "磁共振室", "体检科", "高压氧舱楼", "眼科医院"],
    nameOnly: true,
  },
  shopping: {
    label: "购物",
    categories: ["shopping"],
    keywords: ["购物中心", "购物广场", "大型广场", "大型购物广场", "商场", "商业广场", "购物城", "海岸城", "天虹", "万昌商业广场", "常兴广场", "万象", "来福士"],
    excludeKeywords: ["超市", "便利", "专卖", "体验店", "旗舰店", "门店"],
    nameOnly: true,
    beforeParenthesesOnly: true,
  },
  milkTea: {
    label: "奶茶",
    categories: ["food"],
    keywords: ["奶茶", "茶饮", "饮品", "茶", "喜茶", "奈雪", "蜜雪"],
  },
  sports: {
    label: "运动",
    categories: ["leisure"],
    keywords: ["运动", "健身", "体育", "球", "游泳", "瑜伽", "篮球", "羽毛球"],
  },
  coffee: {
    label: "咖啡",
    categories: ["food", "leisure"],
    keywords: ["咖啡", "coffee", "星巴克", "瑞幸", "costa"],
  },
};

const els = {
  centerName: document.querySelector("#centerName"),
  centerAddress: document.querySelector("#centerAddress"),
  dormSelect: document.querySelector("#dormSelect"),
  radiusRange: document.querySelector("#radiusRange"),
  radiusLabel: document.querySelector("#radiusLabel"),
  categoryFilters: document.querySelector("#categoryFilters"),
  toggleAllBtn: document.querySelector("#toggleAllBtn"),
  dataBadge: document.querySelector("#dataBadge"),
  totalCount: document.querySelector("#totalCount"),
  typeCount: document.querySelector("#typeCount"),
  scoreValue: document.querySelector("#scoreValue"),
  scoreCaption: document.querySelector("#scoreCaption"),
  intentSelect: document.querySelector("#intentSelect"),
  intentResults: document.querySelector("#intentResults"),
  statusWindow: document.querySelector("#statusWindow"),
  statusDorm: document.querySelector("#statusDorm"),
  statusSource: document.querySelector("#statusSource"),
  statusRoute: document.querySelector("#statusRoute"),
  statusCount: document.querySelector("#statusCount"),
  mapPoiCard: document.querySelector("#mapPoiCard"),
  mapPoiName: document.querySelector("#mapPoiName"),
  mapPoiMeta: document.querySelector("#mapPoiMeta"),
  mapPoiDistance: document.querySelector("#mapPoiDistance"),
  mapPoiTypeIcon: document.querySelector("#mapPoiTypeIcon"),
  fallbackPoints: document.querySelector("#fallbackPoints"),
  fallbackCenterPin: document.querySelector("#fallbackCenterPin"),
  radiusCircle: document.querySelector("#radiusCircle"),
  fallbackMap: document.querySelector("#fallbackMap"),
  amapContainer: document.querySelector("#amapContainer"),
  categoryNote: document.querySelector("#categoryNote"),
  categoryFallback: document.querySelector("#categoryFallback"),
  categoryNearestList: document.querySelector("#categoryNearestList"),
  ringChart: document.querySelector("#ringChart"),
  ringFallback: document.querySelector("#ringFallback"),
  timeReachableList: document.querySelector("#timeReachableList"),
  radarFallback: document.querySelector("#radarFallback"),
  comparisonNote: document.querySelector("#comparisonNote"),
  comparisonHighlights: document.querySelector("#comparisonHighlights"),
  comparisonChart: document.querySelector("#comparisonChart"),
  comparisonFallback: document.querySelector("#comparisonFallback"),
  comparisonMatrix: document.querySelector("#comparisonMatrix"),
  comparisonTable: document.querySelector("#comparisonTable"),
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `请求失败: ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.message || message;
    } catch (error) {
      // Keep the HTTP status message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function debounce(fn, delay = 180) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function loadOptionalScript(src, timeoutMs = 3000) {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const script = document.createElement("script");
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    script.src = src;
    script.async = true;
    script.onload = done;
    script.onerror = done;
    document.head.appendChild(script);
    window.setTimeout(done, timeoutMs);
  });
}

async function boot() {
  const config = await fetchJson("/api/config");
  state.center = config.center;
  state.dorms = config.dorms || [];
  state.selectedDormId = config.defaultDormId;
  state.minutes = config.defaultWalkMinutes || 30;
  state.campusAnchors = config.campusAnchors || [];
  state.categories = config.categories;
  state.selectedCategories = new Set(Object.keys(config.categories));

  els.radiusRange.value = state.minutes;
  els.radiusLabel.textContent = `${state.minutes}min`;
  renderDormOptions();
  updateCenterSummary();
  renderCategoryFilters();
  wireEvents();

  await loadOptionalScript("https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js", 3600);

  if (config.amapJsKey) {
    await loadAmap(config.amapJsKey, config.amapSecurityCode);
  }

  initCharts();
  await refreshData();
}

function wireEvents() {
  const debouncedRefresh = debounce(refreshData, 120);
  els.radiusRange.addEventListener("input", () => {
    state.minutes = Number(els.radiusRange.value);
    els.radiusLabel.textContent = `${state.minutes}min`;
    updateRadiusCircle();
    state.hasFitAmap = false;
    debouncedRefresh();
  });

  els.dormSelect.addEventListener("change", () => {
    state.selectedDormId = els.dormSelect.value;
    const dorm = getSelectedDorm();
    if (dorm) {
      state.center = dorm;
      updateCenterSummary();
      if (state.amap) {
        state.amap.setCenter([dorm.lng, dorm.lat]);
      }
    }
    state.hasFitAmap = false;
    refreshData();
  });

  els.toggleAllBtn.addEventListener("click", () => {
    const keys = Object.keys(state.categories);
    if (state.selectedCategories.size === keys.length) {
      state.selectedCategories = new Set([keys[0]]);
    } else {
      state.selectedCategories = new Set(keys);
    }
    renderCategoryFilters();
    state.hasFitAmap = false;
    refreshData();
  });

  els.intentSelect?.addEventListener("change", () => {
    state.selectedIntentKey = els.intentSelect.value;
    renderIntentSearchResults({ autoSelect: true });
  });

  window.addEventListener("resize", debounce(() => {
    Object.values(state.charts).forEach((chart) => chart && chart.resize());
    renderMap();
  }, 120));

  initFallbackDrag();
  initAmapManualDrag();
}

function renderCategoryFilters() {
  els.categoryFilters.innerHTML = "";
  Object.entries(state.categories).forEach(([key, category]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip ${state.selectedCategories.has(key) ? "" : "is-off"}`;
    button.dataset.category = key;
    button.innerHTML = `
      <span class="category-icon category-icon-${key}" style="--category-color:${category.color}" aria-hidden="true">
        <span></span>
      </span>
      <span class="filter-label">${category.label}</span>
    `;
    button.addEventListener("click", () => {
      if (state.selectedCategories.has(key) && state.selectedCategories.size > 1) {
        state.selectedCategories.delete(key);
      } else {
        state.selectedCategories.add(key);
      }
      renderCategoryFilters();
      state.hasFitAmap = false;
      refreshData();
    });
    els.categoryFilters.appendChild(button);
  });
}

function renderDormOptions() {
  els.dormSelect.innerHTML = "";
  state.dorms.forEach((dorm) => {
    const option = document.createElement("option");
    option.value = dorm.id;
    option.textContent = dorm.name;
    option.selected = dorm.id === state.selectedDormId;
    els.dormSelect.appendChild(option);
  });
  const selected = getSelectedDorm();
  if (selected) {
    state.center = selected;
  }
}

function getSelectedDorm() {
  return state.dorms.find((dorm) => dorm.id === state.selectedDormId) || state.dorms[0] || state.center;
}

function updateCenterSummary() {
  if (!state.center) return;
  els.centerName.textContent = state.center.name;
  els.centerAddress.textContent = state.center.address;
}

async function refreshData() {
  const categories = Array.from(state.selectedCategories).join(",");
  const query = new URLSearchParams({
    minutes: state.minutes,
    categories,
    dorm: state.selectedDormId,
  });
  const comparisonQuery = new URLSearchParams({
    minutes: "10,20,30,45",
    categories,
  });
  const [payload, comparison] = await Promise.all([
    fetchJson(`/api/pois?${query.toString()}`),
    fetchJson(`/api/dorm-comparison?${comparisonQuery.toString()}`),
  ]);
  state.center = payload.center;
  state.pois = payload.pois;
  state.stats = payload.stats;
  state.comparison = comparison;
  state.activePoiId = null;
  if (Number.isInteger(state.selectedTimeRingIndex) && !state.stats.rings[state.selectedTimeRingIndex]) {
    state.selectedTimeRingIndex = null;
  }

  updateCenterSummary();
  renderSummary(payload.source);
  renderMap();
  renderCharts();
  renderComparison();
  renderNearestPoisList();
  renderTimeReachableList();
  resetPoiDetail();
  renderIntentSearchResults({ autoSelect: true });
}

function renderSummary(source) {
  const activeTypes = state.stats.byCategory.filter((item) => item.count > 0).length;
  const sourceLabels = {
    amap_saved: "数据库高德 POI",
    sample: "示例 POI 数据",
  };
  els.dataBadge.textContent = "高德 POI 数据 · 30min 步行可达性分析";
  els.totalCount.textContent = state.stats.total;
  els.typeCount.textContent = activeTypes;
  els.scoreValue.textContent = state.stats.convenienceScore;
  const modeLabel = state.stats.routeMode === "amap" ? "高德步行路径" : "步行估算";
  els.scoreCaption.textContent = "30min 内综合服务能力";
  els.categoryNote.textContent = `${state.stats.total} 个点位`;
  els.statusWindow.textContent = `${state.minutes}min`;
  els.statusDorm.textContent = state.center?.name || "-";
  els.statusSource.textContent = sourceLabels[source] || "数据库 POI";
  els.statusRoute.textContent = modeLabel;
  els.statusCount.textContent = state.stats.total;
}

function resetPoiDetail() {
  els.mapPoiName.textContent = "选择地图点位";
  els.mapPoiMeta.textContent = "点击地图上的彩色点位查看设施信息。";
  els.mapPoiDistance.textContent = "-";
  updatePoiTypeIcon(null);
}

function selectPoi(poi, options = {}) {
  state.activePoiId = poi.id;
  const modeLabel = poi.routeMode === "amap" ? "高德步行" : "估算步行";
  els.mapPoiName.textContent = poi.name;
  els.mapPoiDistance.textContent = `${poi.walkMinutes}min`;
  els.mapPoiMeta.textContent = `${poi.categoryLabel} | ${modeLabel} ${poi.walkDistance}m | ${poi.address}`;
  updatePoiTypeIcon(poi);
  renderMap();
  if (options.focusMap) {
    focusMapOnPoi(poi);
  }
  renderNearestPoisList();
  renderTimeReachableList();
  renderIntentSearchResults({ autoSelect: false });
}

function updatePoiTypeIcon(poi) {
  if (!els.mapPoiTypeIcon) return;
  const categoryKeys = Object.keys(state.categories || {});
  els.mapPoiTypeIcon.classList.remove(
    "is-visible",
    ...categoryKeys.map((key) => `category-icon-${key}`)
  );
  els.mapPoiTypeIcon.style.removeProperty("--category-color");

  if (!poi || !state.categories?.[poi.category]) {
    return;
  }

  els.mapPoiTypeIcon.classList.add("is-visible", `category-icon-${poi.category}`);
  els.mapPoiTypeIcon.style.setProperty("--category-color", state.categories[poi.category].color);
}

function renderIntentSearchResults(options = {}) {
  if (!els.intentResults) return;
  const intent = INTENT_OPTIONS[state.selectedIntentKey];
  if (!intent) {
    els.intentResults.innerHTML = `<div class="nearest-empty">选择目的后显示最近点位</div>`;
    return;
  }

  const items = findIntentPois(intent).slice(0, 3);
  if (!items.length) {
    els.intentResults.innerHTML = `<div class="nearest-empty">当前范围暂无${intent.label}点位</div>`;
    return;
  }

  els.intentResults.innerHTML = `
    <div class="nearest-items">
      ${items.map((poi, index) => nearestPoiRow(poi, index)).join("")}
    </div>
  `;

  els.intentResults.querySelectorAll(".nearest-item").forEach((button) => {
    button.addEventListener("click", () => {
      const poi = state.pois.find((item) => item.id === button.dataset.poiId);
      if (poi) {
        selectPoi(poi, { focusMap: true });
      }
    });
  });

  if (options.autoSelect) {
    selectPoi(items[0], { focusMap: true });
  }
}

function findIntentPois(intent) {
  const categories = new Set(intent.categories || []);
  const keywords = (intent.keywords || []).map((item) => item.toLowerCase());
  const excludeKeywords = (intent.excludeKeywords || []).map((item) => item.toLowerCase());
  return state.pois
    .filter((poi) => {
      if (categories.size && !categories.has(poi.category)) {
        return false;
      }
      const name = String(poi.name || "");
      const searchableName = intent.beforeParenthesesOnly ? name.split(/[（(]/)[0] : name;
      const haystack = intent.nameOnly
        ? searchableName.toLowerCase()
        : `${searchableName} ${poi.address || ""} ${poi.categoryLabel || ""}`.toLowerCase();
      if (excludeKeywords.some((keyword) => haystack.includes(keyword))) {
        return false;
      }
      if (!keywords.length) {
        return true;
      }
      return keywords.some((keyword) => haystack.includes(keyword));
    })
    .sort((a, b) => (a.walkDuration || 0) - (b.walkDuration || 0));
}

function focusMapOnPoi(poi) {
  if (state.useAmap && state.amap) {
    const target = [poi.lng, poi.lat];
    try {
      if (typeof state.amap.setZoomAndCenter === "function") {
        state.amap.setZoomAndCenter(Math.max(state.amap.getZoom?.() || 15, 17), target);
      } else {
        state.amap.setZoom(Math.max(state.amap.getZoom?.() || 15, 17));
        state.amap.setCenter(target);
      }
    } catch (error) {
      state.amap.setCenter(target);
    }
    return;
  }

  const position = projectPoint(poi);
  const rect = els.fallbackMap.getBoundingClientRect();
  state.fallbackPan.x = rect.width * (0.5 - position.x / 100);
  state.fallbackPan.y = rect.height * (0.5 - position.y / 100);
  updateFallbackPan();
}

function renderMap() {
  if (state.useAmap && state.amap) {
    renderAmap();
  } else {
    updateFallbackPan();
    updateRadiusCircle();
    updateFallbackCenterPin();
    renderFallbackPoints();
  }
}

function initFallbackDrag() {
  els.fallbackMap.addEventListener("pointerdown", (event) => {
    if (state.useAmap || event.target.closest(".fallback-point")) return;
    state.fallbackDrag = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: state.fallbackPan.x,
      baseY: state.fallbackPan.y,
    };
    els.fallbackMap.classList.add("is-dragging");
    try {
      els.fallbackMap.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is a convenience; dragging still works without it.
    }
  });

  els.fallbackMap.addEventListener("pointermove", (event) => {
    if (!state.fallbackDrag) return;
    state.fallbackPan.x = state.fallbackDrag.baseX + event.clientX - state.fallbackDrag.startX;
    state.fallbackPan.y = state.fallbackDrag.baseY + event.clientY - state.fallbackDrag.startY;
    updateFallbackPan();
  });

  const stopDrag = (event) => {
    if (!state.fallbackDrag) return;
    state.fallbackDrag = null;
    els.fallbackMap.classList.remove("is-dragging");
    if (els.fallbackMap.hasPointerCapture(event.pointerId)) {
      els.fallbackMap.releasePointerCapture(event.pointerId);
    }
  };

  els.fallbackMap.addEventListener("pointerup", stopDrag);
  els.fallbackMap.addEventListener("pointercancel", stopDrag);
}

function updateFallbackPan() {
  els.fallbackMap.style.transform = `translate(${state.fallbackPan.x}px, ${state.fallbackPan.y}px)`;
}

function initAmapManualDrag() {
  els.amapContainer.addEventListener("pointerdown", (event) => {
    if (!state.useAmap || !state.amap || event.target.closest(".amap-marker-dot")) return;
    event.preventDefault();
    state.amapDrag = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    els.amapContainer.classList.add("is-dragging");
    try {
      els.amapContainer.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture is a convenience; dragging still works without it.
    }
  }, true);

  els.amapContainer.addEventListener("pointermove", (event) => {
    if (!state.amapDrag || !state.amap) return;
    event.preventDefault();
    const dx = event.clientX - state.amapDrag.lastX;
    const dy = event.clientY - state.amapDrag.lastY;
    state.amapDrag.lastX = event.clientX;
    state.amapDrag.lastY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      state.amap.panBy(dx, dy);
    }
  }, true);

  const stopDrag = (event) => {
    if (!state.amapDrag) return;
    state.amapDrag = null;
    els.amapContainer.classList.remove("is-dragging");
    if (els.amapContainer.hasPointerCapture(event.pointerId)) {
      els.amapContainer.releasePointerCapture(event.pointerId);
    }
  };

  els.amapContainer.addEventListener("pointerup", stopDrag, true);
  els.amapContainer.addEventListener("pointercancel", stopDrag, true);
}

function updateRadiusCircle() {
  const size = getFallbackRadiusSize();
  els.radiusCircle.style.width = `${size}px`;
  els.radiusCircle.style.height = `${size}px`;
}

function getFallbackRadiusSize() {
  return 150 + (state.minutes / 45) * 310;
}

function updateFallbackCenterPin() {
  if (!els.fallbackCenterPin || !state.center) return;
  const position = projectPoint(state.center);
  els.fallbackCenterPin.style.left = `${position.x}%`;
  els.fallbackCenterPin.style.top = `${position.y}%`;
}

function renderFallbackPoints() {
  els.fallbackPoints.innerHTML = "";
  state.pois.forEach((poi, index) => {
    const position = projectPoi(poi);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `fallback-point ${state.activePoiId === poi.id ? "is-active" : ""}`;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.style.background = poi.color;
    button.style.animationDelay = `${index * 22}ms`;
    button.title = `${poi.name} ${poi.distance}m`;
    button.addEventListener("click", () => selectPoi(poi));
    els.fallbackPoints.appendChild(button);
  });
}

function projectPoi(poi) {
  return projectPoint(poi);
}

function projectPoint(point) {
  const allPoints = [...state.pois, ...state.campusAnchors, state.center].filter(Boolean);
  const lngs = allPoints.map((item) => item.lng);
  const lats = allPoints.map((item) => item.lat);
  const rawMinLng = Math.min(...lngs);
  const rawMaxLng = Math.max(...lngs);
  const rawMinLat = Math.min(...lats);
  const rawMaxLat = Math.max(...lats);
  const lngPadding = Math.max((rawMaxLng - rawMinLng) * 0.08, 0.001);
  const latPadding = Math.max((rawMaxLat - rawMinLat) * 0.08, 0.001);
  const minLng = rawMinLng - lngPadding;
  const maxLng = rawMaxLng + lngPadding;
  const minLat = rawMinLat - latPadding;
  const maxLat = rawMaxLat + latPadding;
  const x = clamp(((point.lng - minLng) / (maxLng - minLng)) * 100, 5, 95);
  const y = clamp(100 - ((point.lat - minLat) / (maxLat - minLat)) * 100, 6, 94);
  return { x, y };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function loadAmap(key, securityCode) {
  if (securityCode) {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
  }
  await loadOptionalScript(`https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`, 4000);

  if (!window.AMap) {
    state.useAmap = false;
    els.fallbackMap.style.display = "block";
    return;
  }

  state.useAmap = true;
  els.amapContainer.style.display = "block";
  els.fallbackMap.style.display = "none";
  state.amap = new window.AMap.Map("amapContainer", {
    center: [state.center.lng, state.center.lat],
    zoom: 15,
    mapStyle: "amap://styles/normal",
    dragEnable: true,
    zoomEnable: true,
    touchZoom: true,
    doubleClickZoom: true,
    scrollWheel: true,
    animateEnable: true,
  });
  state.amap.setStatus({
    dragEnable: true,
    zoomEnable: true,
    scrollWheel: true,
    touchZoom: true,
    doubleClickZoom: true,
  });
  state.amap.on("zoomend", updateAmapLayerMode);
}

function renderAmap() {
  state.amap.setStatus({
    dragEnable: true,
    zoomEnable: true,
    scrollWheel: true,
    touchZoom: true,
    doubleClickZoom: true,
  });
  state.amapMarkers.forEach((marker) => marker.setMap(null));
  state.amapMarkers = [];
  state.amapPoiMarkers = [];

  state.amapRangeOverlays.forEach((overlay) => overlay.setMap(null));
  state.amapRangeOverlays = [];

  const circle = new window.AMap.Circle({
    center: [state.center.lng, state.center.lat],
    radius: state.stats?.searchRadius || state.minutes * 95,
    fillColor: "#0f9d7a",
    fillOpacity: 0.10,
    strokeColor: "#0f9d7a",
    strokeWeight: 2,
    strokeOpacity: 0.55,
    bubble: true,
    map: state.amap,
  });
  state.amapRangeOverlays.push(circle);

  const campusMarker = new window.AMap.Marker({
    position: [state.center.lng, state.center.lat],
    title: state.center.name,
    content: '<div class="campus-marker-dot"></div>',
    offset: new window.AMap.Pixel(-7, -7),
    bubble: true,
    map: state.amap,
  });
  state.amapMarkers.push(campusMarker);

  state.pois.forEach((poi) => {
    const isActive = state.activePoiId === poi.id;
    const marker = new window.AMap.Marker({
      position: [poi.lng, poi.lat],
      title: poi.name,
      content: `<div class="amap-marker-dot ${isActive ? "is-active" : ""}" style="background:${poi.color}"></div>`,
      offset: new window.AMap.Pixel(isActive ? -12 : -9, isActive ? -12 : -9),
      bubble: true,
      map: state.amap,
    });
    marker.on("click", () => selectPoi(poi));
    state.amapMarkers.push(marker);
    state.amapPoiMarkers.push(marker);
  });

  const activePoi = state.pois.find((poi) => poi.id === state.activePoiId);
  if (activePoi?.routePath?.length) {
    const routeLine = new window.AMap.Polyline({
      path: activePoi.routePath.map((point) => point.split(",").map(Number)),
      strokeColor: activePoi.color,
      strokeWeight: 6,
      strokeOpacity: 0.82,
      lineJoin: "round",
      lineCap: "round",
      zIndex: 70,
      map: state.amap,
    });
    state.amapRangeOverlays.push(routeLine);
  }

  const fitTargets = state.amapMarkers;
  if (fitTargets.length && !state.hasFitAmap) {
    state.amap.setFitView(fitTargets, false, [28, 28, 28, 28]);
    state.hasFitAmap = true;
  }

  updateAmapHeatmap();
  updateAmapLayerMode();
}

function ensureAmapHeatmap() {
  if (state.amapHeatmap) {
    return Promise.resolve(state.amapHeatmap);
  }
  if (state.amapHeatmapPromise) {
    return state.amapHeatmapPromise;
  }
  if (!state.amap || !window.AMap?.plugin) {
    return Promise.resolve(null);
  }

  state.amapHeatmapPromise = new Promise((resolve) => {
    window.AMap.plugin(["AMap.HeatMap"], () => {
      if (!window.AMap?.HeatMap) {
        resolve(null);
        return;
      }
      state.amapHeatmap = new window.AMap.HeatMap(state.amap, {
        radius: 28,
        opacity: [0, 0.82],
        gradient: {
          0.25: "#2f80ed",
          0.45: "#0f9d7a",
          0.65: "#f2c94c",
          0.82: "#e85d3f",
          1.0: "#9b1c31",
        },
        zooms: [3, AMAP_MARKER_ZOOM_THRESHOLD],
      });
      resolve(state.amapHeatmap);
    });
  });
  return state.amapHeatmapPromise;
}

function updateAmapHeatmap() {
  ensureAmapHeatmap().then((heatmap) => {
    if (!heatmap) {
      updateAmapLayerMode();
      return;
    }
    heatmap.setDataSet({
      data: state.pois.map((poi) => ({
        lng: poi.lng,
        lat: poi.lat,
        count: 1,
      })),
      max: 8,
    });
    updateAmapLayerMode();
  });
}

function updateAmapLayerMode() {
  if (!state.amap) return;
  const zoom = typeof state.amap.getZoom === "function" ? state.amap.getZoom() : 0;
  const canShowHeatmap = Boolean(state.amapHeatmap && state.pois.length);
  const showMarkers = !canShowHeatmap || zoom >= AMAP_MARKER_ZOOM_THRESHOLD;

  state.amapPoiMarkers.forEach((marker) => {
    if (showMarkers && typeof marker.show === "function") {
      marker.show();
    } else if (!showMarkers && typeof marker.hide === "function") {
      marker.hide();
    }
  });

  if (state.amapHeatmap) {
    if (showMarkers && typeof state.amapHeatmap.hide === "function") {
      state.amapHeatmap.hide();
    } else if (!showMarkers && typeof state.amapHeatmap.show === "function") {
      state.amapHeatmap.show();
    }
  }
}

function initCharts() {
  if (!window.echarts) {
    document.querySelectorAll(".chart").forEach((node) => {
      node.style.display = "none";
    });
    document.querySelectorAll(".fallback-chart").forEach((node) => {
      node.style.display = "block";
    });
    return;
  }
  state.charts.category = window.echarts.init(document.querySelector("#categoryChart"));
  state.charts.ring = window.echarts.init(document.querySelector("#ringChart"));
  state.charts.radar = window.echarts.init(document.querySelector("#radarChart"));
  if (els.comparisonChart) {
    state.charts.comparison = window.echarts.init(els.comparisonChart);
  }
  state.charts.category.on("click", (params) => {
    const item = state.stats?.byCategory?.[params.dataIndex];
    if (item) {
      selectNearestCategory(item.key);
    }
  });
  state.charts.ring.on("click", (params) => {
    const ringIndex = Number(params.dataIndex);
    if (Number.isInteger(ringIndex)) {
      selectTimeRing(ringIndex);
    }
  });
  els.ringChart.addEventListener("click", handleRingChartSectorClick);
  state.charts.ring.getZr().on("click", handleRingChartSectorClick);
}

function renderCharts() {
  renderFallbackCharts();
  if (!window.echarts || !state.charts.category) {
    return;
  }
  renderCategoryChart();
  renderRingChart();
  renderRadarChart();
}

function renderComparison() {
  if (!state.comparison) return;
  renderComparisonHighlights();
  renderComparisonMatrix();
  renderComparisonTable();
  renderComparisonFallback();
  if (state.charts.comparison) {
    renderComparisonChart();
  }
}

function getComparisonWindow() {
  const minutes = state.comparison?.minutes || [];
  if (!minutes.length) return state.minutes;
  if (minutes.includes(state.minutes)) return state.minutes;
  return minutes.reduce((best, item) => (
    Math.abs(item - state.minutes) < Math.abs(best - state.minutes) ? item : best
  ), minutes[0]);
}

function getComparisonRowsForWindow() {
  const windowMinutes = getComparisonWindow();
  return (state.comparison?.rows || []).filter((row) => row.minutes === windowMinutes);
}

function renderComparisonChart() {
  const comparison = state.comparison;
  const minutes = comparison.minutes || [];
  const dorms = comparison.dorms || [];
  state.charts.comparison.setOption({
    grid: { left: 38, right: 18, top: 28, bottom: 34 },
    tooltip: { trigger: "axis" },
    legend: {
      top: 0,
      right: 0,
      textStyle: { color: "#69747c" },
    },
    xAxis: {
      type: "category",
      data: minutes.map((item) => `${item}min`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#dce3df" } },
      axisLabel: { color: "#69747c" },
    },
    yAxis: {
      type: "value",
      max: 100,
      splitLine: { lineStyle: { color: "#eef3ef" } },
      axisLabel: { color: "#69747c" },
    },
    series: dorms.map((dorm, index) => ({
      name: dorm.name,
      type: "bar",
      barMaxWidth: 24,
      data: minutes.map((minute) => {
        const row = comparison.rows.find((item) => item.dormId === dorm.id && item.minutes === minute);
        return row ? row.convenienceScore : 0;
      }),
      itemStyle: {
        color: ["#0f9d7a", "#2f80ed", "#e85d3f"][index % 3],
        borderRadius: [5, 5, 0, 0],
      },
    })),
  });
}

function renderComparisonHighlights() {
  const rows = getComparisonRowsForWindow();
  const windowMinutes = getComparisonWindow();
  if (!rows.length) {
    els.comparisonHighlights.innerHTML = "";
    return;
  }
  const bestScore = [...rows].sort((a, b) => b.convenienceScore - a.convenienceScore)[0];
  const fastest = [...rows]
    .filter((row) => row.avgMinutes > 0)
    .sort((a, b) => a.avgMinutes - b.avgMinutes)[0] || rows[0];
  const richest = [...rows].sort((a, b) => b.total - a.total)[0];
  els.comparisonNote.textContent = "";
  els.comparisonHighlights.innerHTML = [
    comparisonHighlightCard("便利度最高", bestScore.dormName, bestScore.convenienceScore, "分"),
    comparisonHighlightCard("平均步行最短", fastest.dormName, fastest.avgMinutes, "min"),
    comparisonHighlightCard("设施覆盖最多", richest.dormName, richest.total, "处"),
  ].join("");
}

function comparisonHighlightCard(label, dormName, value, unit) {
  return `
    <div class="comparison-highlight-card">
      <span>${label}</span>
      <strong>${escapeHtml(dormName)}</strong>
      <small>${value}${unit}</small>
    </div>
  `;
}

function renderComparisonMatrix() {
  const rows = getComparisonRowsForWindow();
  const categories = state.comparison?.categories || [];
  if (!rows.length || !categories.length) {
    els.comparisonMatrix.innerHTML = `<div class="nearest-empty">暂无对比数据</div>`;
    return;
  }
  const maxCount = Math.max(
    1,
    ...rows.flatMap((row) => categories.map((category) => row.byCategory?.[category.key]?.count || 0))
  );
  const fastestByCategory = Object.fromEntries(
    categories.map((category) => {
      const values = rows
        .map((row) => row.byCategory?.[category.key]?.avgMinutes || 0)
        .filter((value) => value > 0);
      return [category.key, values.length ? Math.min(...values) : 0];
    })
  );
  els.comparisonMatrix.innerHTML = `
    <div class="comparison-matrix-title">
      <span>${getComparisonWindow()}min 各类设施数量</span>
    </div>
    <div class="matrix-grid" style="--category-columns:${categories.length}">
      <div class="matrix-head">宿舍</div>
      ${categories.map((category) => `<div class="matrix-head">${escapeHtml(category.label)}</div>`).join("")}
      ${rows.map((row) => comparisonMatrixRow(row, categories, maxCount, fastestByCategory)).join("")}
    </div>
  `;
}

function comparisonMatrixRow(row, categories, maxCount, fastestByCategory) {
  return `
    <div class="matrix-dorm">${escapeHtml(row.dormName)}</div>
    ${categories.map((category) => {
      const count = row.byCategory?.[category.key]?.count || 0;
      const avg = row.byCategory?.[category.key]?.avgMinutes || 0;
      const isFastest = avg > 0 && avg === fastestByCategory[category.key];
      const opacity = 0.12 + (count / maxCount) * 0.72;
      return `
        <div class="matrix-cell" style="background:${hexToRgba(category.color, opacity)}">
          <strong>${count}</strong>
          <span class="${isFastest ? "is-fastest" : ""}">${avg ? `${avg}min` : "-"}</span>
        </div>
      `;
    }).join("")}
  `;
}

function renderComparisonTable() {
  const rows = getComparisonRowsForWindow();
  const categories = state.comparison?.categories || [];
  if (!rows.length) {
    els.comparisonTable.innerHTML = "";
    return;
  }
  els.comparisonTable.innerHTML = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>宿舍</th>
          <th>设施总量</th>
          <th>便利度</th>
          <th>平均步行</th>
          ${categories.map((category) => `<th>${escapeHtml(category.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.dormName)}</td>
            <td>${row.total}</td>
            <td>${row.convenienceScore}</td>
            <td>${row.avgMinutes || "-"}min</td>
            ${categories.map((category) => `<td>${row.byCategory?.[category.key]?.count || 0}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderComparisonFallback() {
  if (!els.comparisonFallback || !state.comparison) return;
  const rows = state.comparison.rows || [];
  const maxScore = Math.max(1, ...rows.map((row) => row.convenienceScore));
  els.comparisonFallback.innerHTML = rows
    .map((row) => barRow(`${row.dormName} ${row.minutes}m`, row.convenienceScore, maxScore, "#0f9d7a"))
    .join("");
}

function renderCategoryChart() {
  const data = state.stats.byCategory;
  const hasSelection = Boolean(state.selectedNearestCategoryKey);
  state.charts.category.setOption({
    grid: { left: 34, right: 16, top: 20, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#dce3df" } },
      axisLabel: { color: "#69747c" },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#eef3ef" } },
      axisLabel: { color: "#69747c" },
    },
    series: [
      {
        type: "bar",
        data: data.map((item) => ({
          value: item.count,
          itemStyle: {
            color: item.color,
            borderRadius: [5, 5, 0, 0],
            opacity: hasSelection && state.selectedNearestCategoryKey !== item.key ? 0.38 : 1,
          },
        })),
        barWidth: 32,
      },
    ],
  });
}

function renderRingChart() {
  const data = state.stats.rings.length
    ? state.stats.rings
    : [{ label: "暂无", count: 0 }];
  const hasSelection = Number.isInteger(state.selectedTimeRingIndex);
  state.charts.ring.setOption({
    tooltip: { trigger: "item" },
    color: ["#0f9d7a", "#2f80ed", "#d69b13", "#e85d3f"],
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        label: {
          formatter: "{b}\n{c}",
          color: "#30404a",
          fontSize: 12,
        },
        data: data.map((item, index) => ({
          name: item.label,
          value: item.count,
          itemStyle: {
            opacity: hasSelection && state.selectedTimeRingIndex !== index ? 0.38 : 1,
          },
        })),
      },
    ],
  });
}

function renderRadarChart() {
  const radar = state.stats.radar;
  state.charts.radar.setOption({
    color: ["#0f9d7a"],
    tooltip: {},
    radar: {
      radius: "66%",
      indicator: radar.map((item) => ({ name: item.label, max: 100 })),
      axisName: { color: "#69747c" },
      splitLine: { lineStyle: { color: "#dce3df" } },
      splitArea: {
        areaStyle: {
          color: ["rgba(15,157,122,0.05)", "rgba(47,128,237,0.04)"],
        },
      },
      axisLine: { lineStyle: { color: "#dce3df" } },
    },
    series: [
      {
        type: "radar",
        areaStyle: { opacity: 0.18 },
        data: [{ value: radar.map((item) => item.score), name: "便利度" }],
      },
    ],
  });
}

function renderFallbackCharts() {
  const byCategory = state.stats.byCategory;
  const maxCategory = Math.max(1, ...byCategory.map((item) => item.count));
  els.categoryFallback.innerHTML = byCategory
    .map((item) => categoryBarRow(item, maxCategory))
    .join("");
  els.categoryFallback.querySelectorAll(".category-bar-row").forEach((button) => {
    button.addEventListener("click", () => selectNearestCategory(button.dataset.category));
  });

  const rings = state.stats.rings.length ? state.stats.rings : [{ label: "暂无", count: 0 }];
  const maxRing = Math.max(1, ...rings.map((item) => item.count));
  els.ringFallback.innerHTML = rings
    .map((item, index) => ringBarRow(item, index, maxRing))
    .join("");
  els.ringFallback.querySelectorAll(".ring-bar-row").forEach((button) => {
    button.addEventListener("click", () => selectTimeRing(Number(button.dataset.ringIndex)));
  });

  const radar = state.stats.radar;
  els.radarFallback.innerHTML = radar.map((item) => barRow(item.label, item.score, 100, "#0f9d7a")).join("");
}

function selectNearestCategory(categoryKey) {
  if (!categoryKey || !state.categories[categoryKey]) return;
  state.selectedNearestCategoryKey = categoryKey;
  if (state.charts.category) {
    renderCategoryChart();
  }
  renderFallbackCharts();
  renderNearestPoisList();
}

function renderNearestPoisList() {
  if (!els.categoryNearestList) return;
  const categoryKey = state.selectedNearestCategoryKey;
  if (!categoryKey || !state.categories[categoryKey]) {
    els.categoryNearestList.innerHTML = `<div class="nearest-empty">待选择设施类型</div>`;
    return;
  }

  const category = state.categories[categoryKey];
  const items = state.pois
    .filter((poi) => poi.category === categoryKey)
    .sort((a, b) => (a.walkDistance || 0) - (b.walkDistance || 0))
    .slice(0, 10);

  if (!items.length) {
    els.categoryNearestList.innerHTML = `<div class="nearest-empty">${category.label}暂无可达点位</div>`;
    return;
  }

  els.categoryNearestList.innerHTML = `
    <div class="nearest-head">
      <span>${category.label}最近点位 Top 10</span>
      <strong>${getSelectedDorm()?.name || "当前宿舍"}</strong>
    </div>
    <div class="nearest-items">
      ${items.map((poi, index) => nearestPoiRow(poi, index)).join("")}
    </div>
  `;

  els.categoryNearestList.querySelectorAll(".nearest-item").forEach((button) => {
    button.addEventListener("click", () => {
      const poi = state.pois.find((item) => item.id === button.dataset.poiId);
      if (poi) {
        selectPoi(poi, { focusMap: true });
      }
    });
  });
}

function selectTimeRing(ringIndex) {
  const rings = state.stats?.rings || [];
  if (!Number.isInteger(ringIndex) || ringIndex < 0 || ringIndex >= rings.length) return;
  state.selectedTimeRingIndex = ringIndex;
  if (state.charts.ring) {
    renderRingChart();
  }
  renderFallbackCharts();
  renderTimeReachableList();
}

function handleRingChartSectorClick(event) {
  const ringIndex = getRingIndexFromPointer(event);
  if (Number.isInteger(ringIndex)) {
    selectTimeRing(ringIndex);
  }
}

function getRingIndexFromPointer(event) {
  const rings = state.stats?.rings || [];
  if (!rings.length || !els.ringChart) return null;

  const total = rings.reduce((sum, ring) => sum + ring.count, 0);
  if (!total) return 0;

  const rect = els.ringChart.getBoundingClientRect();
  const pointerX = typeof event.offsetX === "number"
    ? event.offsetX
    : event.clientX - rect.left;
  const pointerY = typeof event.offsetY === "number"
    ? event.offsetY
    : event.clientY - rect.top;
  const dx = pointerX - rect.width / 2;
  const dy = pointerY - rect.height / 2;
  const distance = Math.hypot(dx, dy);
  const baseRadius = Math.min(rect.width, rect.height) / 2;
  const outerRadius = baseRadius * 0.86;
  if (distance > outerRadius) return null;

  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  let cursor = 0;
  for (let index = 0; index < rings.length; index += 1) {
    cursor += (rings[index].count / total) * 360;
    if (angle <= cursor) {
      return index;
    }
  }
  return rings.length - 1;
}

function renderTimeReachableList() {
  if (!els.timeReachableList) return;
  const ringIndex = state.selectedTimeRingIndex;
  const ring = state.stats?.rings?.[ringIndex];
  const bounds = ring ? parseRingBounds(ring.label) : null;
  if (!ring || !bounds) {
    els.timeReachableList.innerHTML = `<div class="nearest-empty">待选择时间段</div>`;
    return;
  }

  els.timeReachableList.innerHTML = `
    <div class="nearest-head">
      <span>${ring.label}设施类型数量</span>
      <strong>${ring.count}个点位</strong>
    </div>
    <div class="time-category-grid">
      ${timeCategorySummary(bounds)}
    </div>
  `;
}

function parseRingBounds(label) {
  const match = String(label).match(/^(\d+)-(\d+)min$/);
  if (!match) return null;
  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
}

function timeCategorySummary(bounds) {
  return Object.entries(state.categories)
    .map(([key, category]) => {
      const count = state.pois.filter((poi) => {
        const minutes = (poi.walkDuration || 0) / 60;
        return poi.category === key && minutes > bounds.min && minutes <= bounds.max;
      }).length;
      return `
        <div class="time-category-card">
          <span>
            <i style="background:${category.color}"></i>
            ${category.label}
          </span>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function nearestPoiRow(poi, index) {
  const routeLabel = poi.routeMode === "amap" ? "高德步行" : "估算步行";
  return `
    <button class="nearest-item ${state.activePoiId === poi.id ? "is-active" : ""}" type="button" data-poi-id="${escapeHtml(poi.id)}">
      <span class="nearest-rank">${index + 1}</span>
      <span class="nearest-main">
        <strong>${escapeHtml(poi.name)}</strong>
        <small>${escapeHtml(poi.address || "暂无地址")}</small>
      </span>
      <span class="nearest-metric">
        <strong>${poi.walkMinutes}min</strong>
        <small>${routeLabel} ${poi.walkDistance}m</small>
      </span>
    </button>
  `;
}

function categoryBarRow(item, max) {
  const width = Math.round((item.count / max) * 100);
  const selected = state.selectedNearestCategoryKey === item.key;
  return `
    <button class="bar-row category-bar-row ${selected ? "is-active" : ""}" type="button" data-category="${item.key}">
      <span>${item.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${item.color}"></div></div>
      <strong>${item.count}</strong>
    </button>
  `;
}

function ringBarRow(item, index, max) {
  const width = Math.round((item.count / max) * 100);
  const selected = state.selectedTimeRingIndex === index;
  return `
    <button class="bar-row ring-bar-row ${selected ? "is-active" : ""}" type="button" data-ring-index="${index}">
      <span>${item.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${ringColor(index)}"></div></div>
      <strong>${item.count}</strong>
    </button>
  `;
}

function barRow(label, value, max, color) {
  const width = Math.round((value / max) * 100);
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
      <strong>${value}</strong>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ringColor(index) {
  return ["#0f9d7a", "#2f80ed", "#d69b13", "#e85d3f"][index % 4];
}

function hexToRgba(hex, opacity) {
  const normalized = String(hex || "#0f9d7a").replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((item) => item + item).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(value, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
}

boot().catch((error) => {
  console.error(error);
  els.dataBadge.textContent = "加载失败";
  els.dataBadge.style.color = "#e85d3f";
});
