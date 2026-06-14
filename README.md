# SZU-LifeScope

深圳大学粤海校区 30 分钟生活圈 WebGIS 可视化分析平台。项目以宿舍生活区为出发点，结合 POI 数据、步行可达性、设施类型筛选和图表分析，展示校园周边餐饮、交通、医疗、购物、休闲等生活服务设施的空间分布。

页面展示名称为 **GeoLifeScope 校园生活圈分析平台**。

## 功能概览

- 宿舍生活圈分析：支持斋区、西南、南区三个宿舍出发点切换。
- 步行时间筛选：支持 10 至 45 分钟范围内按 5 分钟步长筛选。
- 设施分类筛选：支持餐饮、交通、医疗、购物、休闲五类 POI。
- 地图可视化：优先使用高德地图 JS API；没有高德 Key 时使用内置坐标投影地图。
- 热力图与点位图层：高德地图模式下支持缩放联动，低缩放显示热力图，高缩放显示具体点位。
- 点位详情：点击地图点位可查看设施名称、分类、步行时间、距离和地址。
- 意图查询：通过“我要去”选择棋牌、KTV、吃饭、医院、购物、奶茶、运动、咖啡等目的，自动推荐最近点位。
- 图表分析：展示设施类型数量、步行时间分布和综合便利度雷达图。
- 路线缓存：高德步行路线可预计算并写入 SQLite，页面交互时优先读取本地缓存。

## 技术栈

- 后端：Python、Flask、SQLite
- 前端：HTML、CSS、JavaScript
- 地图：高德地图 JS API，可选
- 图表：ECharts，可选；加载失败时使用页面内置 fallback 图表
- 数据：本地示例 POI + 高德 Web 服务 POI

## 快速运行

```powershell
cd E:\Finalweb
python -m pip install -r requirements.txt
python init_db.py
python app.py
```

浏览器访问：

```text
http://127.0.0.1:5000
```

也可以直接双击运行：

```text
start_server.bat
```

## 高德地图配置

项目没有高德 Key 也可以运行，会自动使用本地示例数据和内置地图。若要启用真实高德地图、POI 采集和步行路线缓存，请复制配置示例：

```powershell
copy config_local.example.py config_local.py
```

然后填写：

```python
AMAP_JS_KEY = "你的高德 JS API Key"
AMAP_WEB_KEY = "你的高德 Web 服务 API Key"
AMAP_SECURITY_CODE = "你的高德安全密钥，没有可留空"
```

`config_local.py` 已加入 `.gitignore`，不会上传到 GitHub。

也可以临时使用环境变量：

```powershell
$env:AMAP_JS_KEY="你的高德 JS API Key"
$env:AMAP_WEB_KEY="你的高德 Web 服务 API Key"
$env:AMAP_SECURITY_CODE="你的高德安全密钥"
python app.py
```

## 数据说明

项目使用两个数据来源：

- `data/poi_seed.json`：本地示例 POI 数据，便于无 Key 时演示。
- `data/life_circle.db`：运行时生成的 SQLite 数据库，保存高德 POI、数据采集记录和步行路线缓存。

页面读取数据时会优先使用数据库中的高德 POI；如果没有高德 POI，则回退到本地示例数据。

`data/*.db` 已加入 `.gitignore`，数据库不会上传到 GitHub。

## 采集真实 POI

配置 `AMAP_WEB_KEY` 后，可以运行：

```powershell
python fetch_amap_pois.py --radius 2000 --pages 2
```

也可以通过后端接口刷新数据。刷新流程包括：

1. 围绕校园中心、宿舍区和周边锚点采集高德 POI。
2. 对 POI 去重后写入 SQLite。
3. 预计算宿舍到 POI 的步行路线。
4. 将步行距离、时间和路径写入 `walking_routes` 表。

如只需要补齐已有 POI 的路线缓存，可以运行：

```powershell
python complete_routes.py
```

## 便利度指数

便利度指数固定以 30 分钟生活圈作为计算口径，便于比较不同宿舍生活区的综合服务能力。

单个 POI 的贡献值：

```text
贡献值 = 1 / (1 + 步行分钟)
```

分类可达性：

```text
分类可达性 = Σ 1 / (1 + 步行分钟)
```

分类分数：

```text
分类分数 = 100 × (1 - e ^ (-分类可达性 / 6))
```

综合便利度：

```text
综合便利度 =
餐饮分 × 0.25 +
交通分 × 0.20 +
医疗分 × 0.20 +
购物分 × 0.15 +
休闲分 × 0.20
```

距离越近、数量越多、类型权重越高的设施，对综合便利度贡献越大。

## API 接口

- `GET /api/config`：返回中心点、宿舍点、分类配置、高德 JS Key 等页面配置。
- `GET /api/pois`：按宿舍、步行时间和设施类型返回 POI 与统计结果。
- `GET /api/stats`：返回统计摘要。
- `GET /api/db/info`：返回数据库记录数量、分类统计和最近数据源记录。
- `POST /api/refresh-amap`：刷新高德 POI 数据并预计算路线。
- `POST /api/complete-routes`：补齐步行路线缓存。

常用查询示例：

```text
http://127.0.0.1:5000/api/pois?minutes=30&dorm=ziwei&categories=food,transport
http://127.0.0.1:5000/api/db/info
```

## 数据字段

POI 基础字段：

- `id`：点位编号
- `name`：设施名称
- `category`：设施类型，包含 `food`、`transport`、`medical`、`shopping`、`leisure`
- `address`：地址
- `lng` / `lat`：经纬度
- `source`：数据来源

接口返回时会补充：

- `walkDistance`：步行距离，单位为米
- `walkDuration`：步行时间，单位为秒
- `walkMinutes`：向上取整后的步行分钟
- `routeMode`：`amap` 或 `estimate`
- `routePath`：高德路线折线点
- `categoryLabel`：分类中文名称
- `color`：分类颜色

## 项目结构

```text
E:\Finalweb
├─ app.py                       # Flask 主程序与 API
├─ complete_routes.py           # 补齐步行路线缓存脚本
├─ config.py                    # 配置读取逻辑
├─ config_local.example.py      # 本地高德 Key 配置示例
├─ fetch_amap_pois.py           # 高德 POI 采集脚本
├─ init_db.py                   # 初始化 SQLite 数据库
├─ requirements.txt             # Python 依赖
├─ start_server.bat             # Windows 启动脚本
├─ data
│  └─ poi_seed.json             # 本地示例 POI
├─ static
│  ├─ app.js                    # 前端交互、地图与图表逻辑
│  ├─ styles.css                # 页面样式
│  └─ icons
│     ├─ food.svg
│     ├─ leisure.svg
│     ├─ medical.svg
│     ├─ shopping.svg
│     └─ transport.svg
└─ templates
   └─ index.html                # 页面模板
```

## 可用于课程汇报的知识点

- WebGIS 页面设计
- 高德地图 API 接入
- POI 空间数据采集与清洗
- SQLite 数据库存储与查询
- 步行生活圈与可达性分析
- 距离衰减可达性指数
- 热力图与点位图层切换
- ECharts 图表可视化
- Flask API 与前后端异步通信
- 交互式空间查询与最近点推荐

## Git 提交说明

以下文件不会提交到 GitHub：

- `config_local.py`：本地高德 Key
- `data/*.db`：运行时数据库
- `__pycache__/`、`*.pyc`：Python 缓存文件
- `*.log`：日志文件
