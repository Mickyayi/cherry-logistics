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

3. 推送到 GitHub（触发 Cloudflare Pages 自动部署前端）
```bash
cd ..
git push
```

## 说明

- 后端部署到：`https://cherry-logistics-backend.haofreshbne.workers.dev`
- 前端会自动部署到 Cloudflare Pages
- 部署完成后需等待 1-2 分钟前端构建完成
