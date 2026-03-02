# Render 部署检查清单

## ✅ 部署前检查

### 代码准备
- [ ] 代码已提交到 GitHub
- [ ] `main` 分支是最新的
- [ ] 没有未提交的更改

### Render 账户
- [ ] 已注册 [Render](https://render.com) 账户
- [ ] 已连接 GitHub 账户

---

## 📝 部署步骤清单

### 步骤 1: 创建 PostgreSQL 数据库 ⭐

- [ ] 登录 Render Dashboard
- [ ] 点击 "New +" → "PostgreSQL"
- [ ] 配置数据库：
  - [ ] Name: `wallethub-db`
  - [ ] Database Name: `wallethub`
  - [ ] User: `wallethub`
  - [ ] Plan: **Free**
  - [ ] Region: Oregon
- [ ] 点击 "Create Database"
- [ ] **复制 Internal Database URL** (重要！)

```
postgresql://wallethub:xxxxx@db.xxxx.render.com:5432/wallethub
```

---

### 步骤 2: 创建 Web Service

- [ ] 点击 "New +" → "Web Service"
- [ ] 选择 "Connect a repository"
- [ ] 找到并选择 `wallethub` 仓库

---

### 步骤 3: 配置服务

#### Basic Settings
- [ ] Name: `wallethub-api`
- [ ] Region: Oregon
- [ ] Branch: `main`
- [ ] Root Directory: (留空)
- [ ] Runtime: Node

#### Build Command
- [ ] 复制并粘贴以下完整命令：

```bash
corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm run build:contracts && pnpm run build:api && DATABASE_URL="$DATABASE_URL" pnpm --filter api exec prisma generate --schema=apps/api/prisma/schema.prisma
```

#### Start Command
- [ ] 输入：

```bash
pnpm --filter api run start:prod
```

#### Environment Variables
- [ ] 添加以下环境变量：

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | (步骤 1 复制的 URL) |
| `EXPO_PUBLIC_API_URL` | `https://wallethub-api.onrender.com` |

#### Instance Type
- [ ] 选择 **Free** ($0/mo)

---

### 步骤 4: 部署

- [ ] 点击 "Create Web Service"
- [ ] 等待构建完成 (3-5 分钟)
- [ ] 查看 Logs 确认无错误
- [ ] 记录服务 URL: `https://wallethub-api.onrender.com`

---

### 步骤 5: 数据库迁移

- [ ] 点击 "Shell" 标签
- [ ] 点击 "Connect"
- [ ] 执行迁移命令：

```bash
pnpm --filter api exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

- [ ] 确认无错误

---

## ✅ 验证部署

### 健康检查
- [ ] 访问：`https://wallethub-api.onrender.com/health`
- [ ] 期望响应：`{"status":"ok","timestamp":"..."}`

### API 测试
- [ ] 测试：`https://wallethub-api.onrender.com/session`
- [ ] 测试：`https://wallethub-api.onrender.com/wallets`

---

## 📱 移动端配置

- [ ] 更新移动端 API 地址为：`https://wallethub-api.onrender.com`
- [ ] 重新构建移动端应用
- [ ] 测试钱包连接功能

---

## 🔧 可选优化

### 防止服务休眠
- [ ] 注册 [Uptime Robot](https://uptimerobot.com)
- [ ] 配置监控：
  - URL: `https://wallethub-api.onrender.com/health`
  - 间隔：15 分钟

### 设置告警
- [ ] 在 Render Dashboard 设置告警
- [ ] 配置邮件通知

---

## 💰 成本跟踪

- [ ] 记录创建日期：__________
- [ ] 免费期结束日期：__________ (创建日期 + 90 天)
- [ ] 设置续费提醒

---

## 📞 重要链接

- **Dashboard**: https://dashboard.render.com
- **服务 URL**: https://wallethub-api.onrender.com
- **数据库**: Render Dashboard → Databases → wallethub-db
- **日志**: Render Dashboard → wallethub-api → Logs
- **文档**: https://render.com/docs

---

## 🎯 完成！

全部勾选后，恭喜部署成功！🎉

如有问题，请查看：
- [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) - 详细指南
- Render Dashboard 日志
