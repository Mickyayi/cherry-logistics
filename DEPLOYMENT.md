# 车厘子物流系统 - 部署指南

## 📋 准备工作

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/)
2. 注册 [GitHub 账号](https://github.com/)
3. 安装 [Node.js](https://nodejs.org/) (版本 >= 18)
4. 安装 Wrangler CLI: `npm install -g wrangler`

## 🚀 部署步骤

### 第一步：推送代码到 GitHub

1. 在 GitHub 上创建一个新仓库（例如 `cherry-logistics`）
2. 在本地项目目录执行：

```bash
git remote add origin https://github.com/你的用户名/cherry-logistics.git
git branch -M main
git push -u origin main
```

### 第二步：创建 D1 数据库

1. 打开终端，进入 backend 目录：

```bash
cd backend
```

2. 登录 Cloudflare：

```bash
wrangler login
```

浏览器会自动打开，点击授权。

3. 创建 D1 数据库：

```bash
wrangler d1 create cherry-logistics-db
```

4. 复制返回的 `database_id`，类似这样：

```
✅ Successfully created DB 'cherry-logistics-db'!
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

5. 打开 `backend/wrangler.toml`，找到这一行：

```toml
database_id = "YOUR_DATABASE_ID_HERE"
```

替换为你刚才复制的 `database_id`。

6. 初始化数据库表结构：

```bash
wrangler d1 execute cherry-logistics-db --file=schema.sql
```

看到 `✅ Successfully executed SQL` 表示成功。

### 第三步：部署后端 Worker

在 backend 目录下执行：

```bash
wrangler deploy
```

部署成功后，会显示 Worker 的 URL，类似：

```
Published cherry-logistics-backend
  https://cherry-logistics-backend.你的账号.workers.dev
```

**重要：复制这个 URL，后面会用到！**

### 第四步：部署前端到 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单选择 **Workers & Pages**
3. 点击 **Create application** → 选择 **Pages** → **Connect to Git**
4. 授权 GitHub 后，选择你的仓库 `cherry-logistics`
5. 配置构建设置：
   - **项目名称**: `cherry-logistics` (可自定义)
   - **生产分支**: `main`
   - **框架预设**: 选择 `Vite`
   - **根目录**: `frontend`
   - **构建命令**: `npm run build`
   - **构建输出目录**: `dist`

6. 添加环境变量（重要！）：
   - 点击 **Environment variables (advanced)**
   - 点击 **Add variable**
   - 变量名: `VITE_API_URL`
   - 值: 第三步中复制的 Worker URL（例如：`https://cherry-logistics-backend.你的账号.workers.dev`）
   - 选择 **Production** 和 **Preview**

7. 点击 **Save and Deploy**

等待几分钟，部署完成后会显示你的网站 URL，例如：

```
https://cherry-logistics.pages.dev
```

### 第五步：测试系统

打开前端 URL，测试各个功能：

1. **用户端**：
   - 首页：`https://你的项目.pages.dev/`
   - 提交订单，填写信息后提交
   - 查询订单，输入姓名和电话

2. **客服端**（密码：8888）：
   - 访问：`https://你的项目.pages.dev/admin/login`
   - 查看订单列表
   - 编辑订单信息
   - 审核通过

3. **物流端**（密码：8888）：
   - 访问：`https://你的项目.pages.dev/logistics/login`
   - 查看新订单
   - 复制物流信息
   - 标记为已发货
   - 填写快递单号

## 🔧 更新代码

当你修改代码后，只需要：

```bash
git add .
git commit -m "更新说明"
git push
```

Cloudflare Pages 会自动重新构建和部署前端。

如果修改了后端代码：

```bash
cd backend
wrangler deploy
```

## 🔐 修改管理密码

打开 `backend/src/index.py`，找到：

```python
ADMIN_PASSCODE = "8888"  # 预设密码
```

改成你想要的密码，然后重新部署后端：

```bash
wrangler deploy
```

## ❓ 常见问题

### Q: Worker 部署失败

A: 确保 `wrangler.toml` 中的 `database_id` 已正确填写。

### Q: 前端打开后 API 请求失败

A: 检查 Cloudflare Pages 的环境变量 `VITE_API_URL` 是否正确设置为 Worker 的 URL。

### Q: 如何查看数据库内容？

A: 使用命令：

```bash
wrangler d1 execute cherry-logistics-db --command="SELECT * FROM orders;"
```

### Q: 如何清空数据库？

A: 使用命令：

```bash
wrangler d1 execute cherry-logistics-db --command="DELETE FROM orders;"
```

## 📞 技术支持

如有问题，请查阅：
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)

