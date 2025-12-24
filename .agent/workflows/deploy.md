---
description: Deploy frontend and backend to Cloudflare
---

# 部署流程

## 步骤

// turbo-all

1. 提交代码到 Git
```bash
git add -A
git commit -m "<commit message>"
```

2. 部署后端到 Cloudflare Workers
```bash
cd backend
npx wrangler deploy
```

3. 构建并部署前端到 Cloudflare Pages
```bash
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name=cherry-logistics
```

4. 推送到 GitHub
```bash
cd ..
git push
```

## 说明

- 后端部署到：`https://cherry-logistics-backend.haofreshbne.workers.dev`
- 前端部署到：`https://cherry-logistics.pages.dev`
- 部署完成后立即生效
