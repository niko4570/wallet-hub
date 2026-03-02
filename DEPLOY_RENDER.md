# WalletHub Render 部署指南

## 📋 部署前准备

### 1. 安装 Render CLI (可选)
```bash
# 使用 npm 安装
npm install -g @render-cloud/cli

# 或使用 yarn
yarn global add @render-cloud/cli
```

---

## 🚀 部署方法

### 方法一：使用 render.yaml（推荐）

#### 1. 推送到 GitHub
```bash
git add render.yaml .render.env
git commit -m "Add Render deployment configuration"
git push origin main
```

#### 2. 在 Render 控制台部署

1. **访问** [https://render.com](https://render.com) 并登录

2. **创建新服务**
   - 点击 "New +" → "Blueprint"
   - 连接你的 GitHub 仓库
   - 选择 `wallethub` 仓库

3. **Render 会自动识别 render.yaml**
   - 创建 Web 服务：`wallethub-api`
   - 创建数据库：`wallethub-db`

4. **配置环境变量**
   - Render 会自动从 render.yaml 读取大部分配置
   - 手动添加以下环境变量（如果需要）:
     ```
     EXPO_PUBLIC_API_URL=https://wallethub-api.onrender.com
     ```

5. **点击 "Apply"** 开始部署

---

### 方法二：手动部署

#### 1. 创建 PostgreSQL 数据库

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 "New +" → "PostgreSQL"
3. 配置数据库:
   - **Name**: `wallethub-db`
   - **Database**: `wallethub`
   - **User**: `wallethub`
   - **Plan**: Free (90 天免费)
   - **Region**: Oregon (US West)

4. 创建后，复制 **Internal Database URL**，格式类似:
   ```
   postgresql://wallethub:xxxxx@db.xxxx.render.com:5432/wallethub
   ```

#### 2. 创建 Web Service

1. 点击 "New +" → "Web Service"
2. 连接 GitHub 仓库
3. 配置服务:

**Basic Settings**:
- **Name**: `wallethub-api`
- **Region**: Oregon
- **Branch**: `main`
- **Root Directory**: (留空)
- **Runtime**: Node

**Build & Start**:
- **Build Command**:
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  pnpm install --frozen-lockfile
  pnpm run build:contracts
  pnpm run build:api
  DATABASE_URL="$DATABASE_URL" pnpm --filter api exec prisma generate --schema=apps/api/prisma/schema.prisma
  ```

- **Start Command**:
  ```bash
  pnpm run start:api
  ```

**Environment Variables**:
添加以下环境变量:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=<从数据库页面复制的 Internal URL>
EXPO_PUBLIC_API_URL=https://wallethub-api.onrender.com
```

**Instance Type**:
- 选择 **Free** (512MB RAM)

4. 点击 "Create Web Service"

---

## 🗄️ 数据库迁移

部署成功后，需要运行数据库迁移：

### 方法一：使用 Render Shell (推荐)

1. 在 Render Dashboard 进入你的 Web Service
2. 点击 "Shell" 标签
3. 连接到服务后执行:

```bash
# 运行 Prisma 迁移
pnpm --filter api run prisma:migrate:deploy

# 或者手动执行
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

### 方法二：本地执行迁移

```bash
# 1. 获取数据库连接字符串
# 在 Render Dashboard → PostgreSQL → Connection 页面复制

# 2. 本地执行迁移
export DATABASE_URL="postgresql://..."
pnpm --filter api run prisma:migrate:deploy
```

---

## ✅ 验证部署

### 1. 检查服务状态

访问 Render Dashboard 查看服务日志:
```
https://dashboard.render.com
```

### 2. 测试健康检查

```bash
# 替换为你的实际域名
curl https://wallethub-api.onrender.com/health
```

期望响应:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T..."
}
```

### 3. 测试 API 端点

```bash
# 获取会话信息
curl https://wallethub-api.onrender.com/session

# 获取钱包列表
curl https://wallethub-api.onrender.com/wallets
```

---

## 🔧 移动端配置

部署成功后，需要更新移动端的 API 地址：

### 更新移动端配置

在移动端代码中，找到 API 配置并更新:

```typescript
// apps/mobile/config/api.ts 或类似文件
export const API_BASE_URL = 'https://wallethub-api.onrender.com';
```

或者在 Expo 环境变量中配置:

```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://wallethub-api.onrender.com
```

---

## 💰 成本估算

### Render 免费计划

**Web Service (Free)**:
- ✅ 512MB RAM
- ✅ 共享 CPU
- ⚠️ 15 分钟无请求会休眠
- ⚠️ 首次访问需等待 30 秒唤醒

**PostgreSQL (Free)**:
- ✅ 1GB 存储
- ✅ 90 天免费
- ⚠️ 90 天后需付费 ($7/月)

**总成本**: 
- **前 90 天**: ¥0
- **90 天后**: 约 ¥50/月 (数据库 $7/月)

---

## 🔧 常见问题

### 1. 构建失败

**错误**: `prisma: command not found`

**解决**: 确保 build command 中包含 prisma generate:
```bash
DATABASE_URL="$DATABASE_URL" pnpm --filter api exec prisma generate --schema=apps/api/prisma/schema.prisma
```

### 2. 数据库连接失败

**检查**:
- 使用 **Internal Database URL** (不是 External)
- 确保 DATABASE_URL 环境变量正确设置
- 检查数据库是否在同一 Render 账户下

### 3. 服务频繁休眠

**解决方案**:
- 使用 [Uptime Robot](https://uptimerobot.com) 每 14 分钟 ping 一次 API
- 或升级到付费计划 ($7/月)

```bash
# Uptime Robot 配置
URL: https://wallethub-api.onrender.com/health
Interval: 15 minutes
```

### 4. 端口错误

确保 `PORT=3000` 已设置，Render 会自动将外部流量映射到 3000 端口。

---

## 📊 监控和日志

### 查看日志

在 Render Dashboard:
1. 进入 Web Service
2. 点击 "Logs" 标签
3. 实时查看应用日志

### 设置告警

1. 进入 Dashboard → "Alerts"
2. 添加告警规则:
   - Service Down
   - High Error Rate
   - Database Connection Failed

---

## 🔄 持续部署

Render 会自动部署每次推送到 `main` 分支的代码：

```bash
# 提交新代码后自动部署
git push origin main
```

查看部署进度:
- Dashboard → Web Service → "Events" 标签

---

## 🎯 优化建议

### 1. 数据库优化

```sql
-- 添加索引（在 Prisma schema 中）
model WalletAccount {
  address String @unique @db.VarChar(255)
  userId  String @index
  // ...
}
```

### 2. 环境变量管理

使用 Render 的环境变量组:
```bash
# 创建 .env 文件
NODE_ENV=production
PORT=3000
DATABASE_URL=...

# 在 Dashboard 批量导入
```

### 3. 性能优化

- 启用 Redis 缓存 (使用 Render Redis，当可用时)
- 优化数据库查询
- 使用连接池

---

## 📞 支持资源

- **Render 文档**: https://render.com/docs
- **社区论坛**: https://community.render.com
- **状态页面**: https://status.render.com

---

## ✅ 部署检查清单

- [ ] 推送到 GitHub
- [ ] 创建 Render 账户
- [ ] 创建 PostgreSQL 数据库
- [ ] 创建 Web Service
- [ ] 配置环境变量
- [ ] 运行数据库迁移
- [ ] 测试健康检查端点
- [ ] 更新移动端 API 地址
- [ ] 验证所有 API 端点
- [ ] 配置监控告警
- [ ] 记录服务 URL 和配置

---

**部署成功！🎉**

如有问题，请查看 Render Dashboard 的日志或提交 Issue。
