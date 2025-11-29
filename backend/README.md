# Cherry Logistics Backend

基于 Python + FastAPI 的车厘子物流系统后端 API，部署在 Cloudflare Workers (Python Runtime)。

## 部署步骤

### 1. 创建 D1 数据库

```bash
# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create cherry-logistics-db

# 记录返回的 database_id，并更新 wrangler.toml 中的 database_id
```

### 2. 初始化数据库表结构

```bash
# 执行 schema.sql 创建表
wrangler d1 execute cherry-logistics-db --file=schema.sql
```

### 3. 部署到 Cloudflare Workers

```bash
# 部署
wrangler deploy
```

## API 接口文档

### 公共接口（无需鉴权）

- `POST /api/orders` - 用户提交订单
- `GET /api/orders/search?name=xxx&phone=xxx` - 用户查询订单

### 管理接口（需要密码验证）

- `POST /api/auth` - 验证管理端密码（8888）
- `GET /api/orders?status=pending&page=1` - 获取订单列表
- `PUT /api/orders/{id}` - 修改订单信息
- `PUT /api/orders/{id}/status` - 更新订单状态
- `PUT /api/orders/{id}/tracking` - 更新快递单号

## 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 本地运行（需要 wrangler dev 支持 Python）
wrangler dev
```

