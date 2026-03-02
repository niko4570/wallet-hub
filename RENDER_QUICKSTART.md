# Render 手动部署快速指南

## 🎯 5 步完成部署

### 步骤 1: 创建 PostgreSQL 数据库

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 **"New +"** → **"PostgreSQL"**
3. 填写配置：

| 字段              | 值                 |
| ----------------- | ------------------ |
| **Name**          | `wallethub-db`     |
| **Database Name** | `wallethub`        |
| **User**          | `wallethub`        |
| **Password**      | (自动生成或自定义) |
| **Plan**          | **Free**           |
| **Region**        | Oregon             |

4. 点击 **"Create Database"**
5. ⚠️ **重要**: 复制 **Internal Database URL** (格式：`postgresql://wallethub:xxx@db.xxx.render.com:5432/wallethub`)

---

### 步骤 2: 创建 Web Service

1. 点击 **"New +"** → **"Web Service"**
2. 选择 **"Connect a repository"**
3. 找到并选择 `wallethub` 仓库

---

### 步骤 3: 配置 Web Service

#### Basic Settings

| 字段               | 值              |
| ------------------ | --------------- |
| **Name**           | `wallethub-api` |
| **Region**         | Oregon          |
| **Branch**         | `main`          |
| **Root Directory** | (留空)          |
| **Runtime**        | Node            |

#### Build & Start Commands

**Build Command** (复制整个代码块):

```bash
corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm run build:contracts && pnpm run build:api && DATABASE_URL="$DATABASE_URL" pnpm --filter api exec prisma generate --schema=apps/api/prisma/schema.prisma
```

**Start Command**:

```bash
pnpm --filter api run start:prod
```

#### Environment Variables

点击 **"Advanced"** → **"Add Environment Variable"**，添加以下变量：

| Key                   | Value                                |
| --------------------- | ------------------------------------ |
| `NODE_ENV`            | `production`                         |
| `PORT`                | `3000`                               |
| `DATABASE_URL`        | (步骤 1 中复制的 Internal URL)       |
| `EXPO_PUBLIC_API_URL` | `https://wallethub-api.onrender.com` |

#### Instance Type

- 选择 **"Free"** ($0/mo, 512 MB RAM)

---

### 步骤 4: 开始部署

1. 点击 **"Create Web Service"**
2. 等待构建完成 (约 3-5 分钟)
3. 查看日志确认部署成功

---

### 步骤 5: 运行数据库迁移

部署成功后，需要初始化数据库：

#### 方法 A: 使用 Render Shell (推荐)

1. 在 Web Service 页面点击 **"Shell"** 标签
2. 点击 **"Connect"**
3. 连接后执行：

```bash
pnpm --filter api exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

#### 方法 B: 本地执行

```bash
# 1. 设置环境变量
export DATABASE_URL="postgresql://..."

# 2. 运行迁移
pnpm --filter api exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## ✅ 验证部署

### 1. 测试健康检查

```bash
curl https://wallethub-api.onrender.com/health
```

期望响应：

```json
{ "status": "ok", "timestamp": "2026-03-02T..." }
```

### 2. 测试 API 端点

```bash
curl https://wallethub-api.onrender.com/session
```

---

## 🔧 常见问题

### 构建失败：`prisma: command not found`

确保 Build Command 中包含 `prisma generate` 步骤。

### 数据库连接失败

- 检查是否使用 **Internal Database URL**
- 确认 DATABASE_URL 环境变量已正确设置

### 服务休眠

免费服务 15 分钟无请求会休眠，首次访问需等待 30 秒。

解决方案：使用 [Uptime Robot](https://uptimerobot.com) 每 14 分钟 ping 一次：

```
URL: https://wallethub-api.onrender.com/health
Interval: 15 minutes
```

---

## 📊 成本

- **前 90 天**: ¥0 (完全免费)
- **90 天后**: ~¥50/月 (数据库 $7/月)

---

## 🎉 完成！

部署成功后，你的 API 地址将是：

```
https://wallethub-api.onrender.com
```

记得更新移动端的 API 配置！
