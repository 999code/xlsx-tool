# XLSX 数据管理

使用 `.xlsx` 文件作为轻量数据存储，由 Node.js 提供增删改查 JSON API，Vue 3 前端负责查询、编辑和 JSON 预览。默认测试文件为项目根目录的 `test.xlsx`。

## 项目结构

```text
backend/   Node.js + Express + ExcelJS API
frontend/  Vue 3 + Element Plus 示例工程
test.xlsx  默认测试工作簿
```

后端将每个工作表第 1 行识别为字段名，从第 2 行开始把非空行识别为记录。接口返回的 `_rowNumber` 是记录当前所在的 Excel 行号。

前端保留了项目原有示例页，并新增同级路由：

- `/#/examples`：原组件示例页面
- `/#/xlsx-manager`：XLSX 数据管理页面；表单使用 `sc-form`，列表使用 `sc-table`

## 本地运行

需要 Node.js 20 或更高版本。

先启动后端：

```bash
cd backend
npm install
npm run dev
```

再启动前端：

```bash
cd frontend
npm install
npm run dev
```

打开 <http://localhost:5173/#/xlsx-manager>。开发服务器会把 `/api` 转发到 `http://localhost:3001`。

## 生产运行

```bash
cd frontend
npm run build

cd ../backend
npm start
```

当 `frontend/dist` 存在时，Node.js 后端会同时托管网页，访问 <http://localhost:3001/#/xlsx-manager> 即可。

## JSON API

| 方法 | 地址 | 作用 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务和工作簿健康状态 |
| `GET` | `/api/workbook` | 工作簿、工作表和字段元数据 |
| `GET` | `/api/workbook/download` | 下载当前工作簿 |
| `GET` | `/api/sheets/:sheet/records` | 分页、搜索并返回 JSON 记录 |
| `GET` | `/api/sheets/:sheet/records/:rowNumber` | 查询单条记录 |
| `POST` | `/api/sheets/:sheet/records` | 新增记录 |
| `PUT` | `/api/sheets/:sheet/records/:rowNumber` | 完整更新记录 |
| `PATCH` | `/api/sheets/:sheet/records/:rowNumber` | 部分更新记录 |
| `DELETE` | `/api/sheets/:sheet/records/:rowNumber` | 删除记录 |

列表查询参数为 `page`、`pageSize`（最大 100）和 `search`。

```text
GET /api/sheets/PC单机游戏/records?page=1&pageSize=20&search=刺客信条
```

## 配置

主要环境变量可参考 `backend/.env.example`：

- `WORKBOOK_PATH`：工作簿路径，默认使用根目录的 `test.xlsx`
- `XLSX_HEADER_ROW`：字段名所在行，默认 `1`
- `XLSX_CREATE_BACKUP`：写入前是否生成备份，默认开启
- `CORS_ORIGIN`：允许访问 API 的前端地址，多个地址使用逗号分隔

当前实现使用进程内队列串行化读写，适合小团队和低并发工具。高并发、跨进程部署或需要事务时应改用正式数据库。

## 验证

```bash
cd backend
npm test

cd ../frontend
npm run lint
npm run build
```
