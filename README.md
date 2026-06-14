# 深圳大学 30 分钟生活圈可视化分析网站

这是一个面向 WebGIS 数据可视化课程作业的 Flask + 前端可视化项目。主题为“深圳大学粤海校区宿舍出发 30 分钟生活圈”，通过地图点位、宿舍起点、步行时间、分类筛选和统计图表展示校园周边餐饮、交通、医疗、购物、休闲设施的空间分布。

## 已包含内容

- 地图可视化：内置坐标投影地图，可选接入高德地图 JS API；地图中心点使用所选宿舍坐标。
- 宿舍起点：支持紫薇斋、乔相阁、夏筝三个宿舍位置选择。
- 数据刷新：页面提供“刷新高德数据”按钮，先从高德采集 POI 并写入 SQLite，再从数据库读取展示。
- 路径规划：刷新高德数据时会预计算三处宿舍到 POI 的步行路线并写入数据库；普通页面切换只读数据库，避免实时请求卡住。
- POI 数据：`data/poi_seed.json` 提供初始点位，启动后导入 SQLite。
- 数据库连接：`data/life_circle.db` 保存设施点位，后端通过 `sqlite3` 查询。
- 后端接口：Flask 提供 `/api/config`、`/api/pois`、`/api/stats`、`/api/db/info`。
- 图表分析：ECharts 可用时展示柱状图、环形图、雷达图；网络不可用时自动显示内置条形图。
- 交互功能：步行时间切换、宿舍选择、设施类型筛选、点位详情、数据库刷新。

## 运行方式

```powershell
cd E:\Finalweb
python -m pip install -r requirements.txt
python init_db.py
python app.py
```

浏览器打开：

```text
http://127.0.0.1:5000
```

## 高德地图实时数据配置

没有 Key 时项目也能使用示例数据完整运行。若要接入高德地图和实时 POI，推荐使用本地配置文件。

复制 `config_local.example.py`，改名为 `config_local.py`：

```python
AMAP_JS_KEY = "你的高德 JS API Key"
AMAP_WEB_KEY = "你的高德 Web服务 API Key"
AMAP_SECURITY_CODE = "你的高德安全密钥，没有可留空"
```

`config_local.py` 已加入 `.gitignore`，不要提交或上传。也可以临时使用环境变量：

```powershell
$env:AMAP_JS_KEY="你的高德 JS API Key"
$env:AMAP_WEB_KEY="你的高德 Web服务 API Key"
$env:AMAP_SECURITY_CODE="你的高德安全密钥"
python app.py
```

页面默认从数据库读取高德 POI。若数据库还没有高德数据，会自动使用示例 POI 兜底。点击“刷新高德数据”后，后端会围绕紫薇斋、乔相阁、夏筝三处宿舍调用高德周边搜索接口，把 POI 写入 SQLite，并预计算步行路径；之后切换宿舍、分类或时间都只从数据库读取，不再临时请求高德实时数据。

## 采集真实 POI 数据

当前仓库自带的 `poi_seed.json` 是用于课堂演示的本地示例数据。若要把作业数据升级为真实采集数据，申请高德 Web 服务 Key 后运行：

```powershell
python fetch_amap_pois.py --radius 2000 --pages 2
```

脚本会围绕深圳大学粤海校区多个校园锚点调用高德地图 Web服务 API 周边搜索接口，把周边 POI 去重后写入 `data/life_circle.db`。页面会优先读取 `source = 'amap'` 的已采集数据；没有高德数据时才读取示例数据。为了避免坐标系偏移，正式展示建议先点击页面上的“刷新高德数据”。

采集记录可以通过接口查看：

```text
http://127.0.0.1:5000/api/db/info
```

## 数据字段

`data/poi_seed.json` 是深圳大学粤海校区周边的初始 POI 数据文件，`data/life_circle.db` 是运行使用的 SQLite 数据库。每个点位包含：

- `id`：点位编号
- `name`：设施名称
- `category`：设施类型，包含 `food`、`transport`、`medical`、`shopping`、`leisure`
- `address`：地址说明
- `lng` / `lat`：经纬度
- `source`：数据来源

数据库表名为 `pois`，字段与 JSON 数据保持一致。可以通过接口查看数据库统计：

```text
http://127.0.0.1:5000/api/db/info
```

## 可用于汇报的课程知识点

- HTML、CSS、JavaScript 页面开发
- Flex/Grid 页面布局
- 地图点位可视化与步行生活圈分析
- ECharts 图表配置项
- Flask 后端接口
- 前后端异步通信
- SQLite 数据库存储与查询
- JSON 数据组织与统计分析

## 分析中心

- 名称：深圳大学粤海校区宿舍生活圈
- 地址：深圳市南山区南海大道3688号
- 宿舍坐标：紫薇斋 `113.939387, 22.533923`；乔相阁 `113.934050, 22.527449`；夏筝 `113.942157, 22.530649`
- 坐标系说明：上述宿舍坐标来自高德 POI，属于高德地图使用的 GCJ-02 坐标系。
- 空间判断方式：以所选宿舍为出发点，优先使用高德步行路径规划 API 计算真实步行距离和时间；示例数据或接口失败时使用估算步行距离。
