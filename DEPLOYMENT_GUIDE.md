# WalletHub Hackathon 部署完整指南

## 📋 提交前检查清单

### 核心功能验证
- [ ] 钱包连接功能正常（MWA 集成）
- [ ] 余额显示和刷新正常
- [ ] 交易历史加载正常
- [ ] 发送交易功能正常
- [ ] 接收功能（二维码）正常
- [ ] 生物识别认证正常工作
- [ ] 多钱包管理功能正常

---

## 🚀 第一部分：部署后端 API

### 选项 A: Railway 部署（推荐 - 最简单）

#### 步骤 1: 准备 Railway 项目

1. 访问 [railway.app](https://railway.app)
2. 使用 GitHub 账号登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你的 `wallethub` 仓库

#### 步骤 2: 配置 Railway

1. 在 Railway 面板中，点击 "New" → "Service"
2. 选择你的 GitHub 仓库
3. Railway 会自动检测 `apps/api/Dockerfile`

#### 步骤 3: 设置环境变量

在 Railway 面板的 "Variables" 标签页中添加：

```bash
# 必需的环境变量
PORT=3000
DATABASE_URL=postgresql://postgres:password@host:5432/wallethub
HELIUS_API_KEY=你的 helius_api_key
JUPITER_API_KEY=你的 jupiter_api_key

# 可选的环境变量
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=你的 helius_api_key
SOLANA_PRIORITY_RPC_URL=https://mainnet.helius-rpc.com/?api-key=你的 helius_api_key
```

#### 步骤 4: 部署

Railway 会自动构建和部署。等待部署完成后，你会得到一个公共 URL，例如：
```
https://wallethub-api-production.up.railway.app
```

**记下这个 URL，后面移动应用需要用到！**

---

### 选项 B: Render 部署

#### 步骤 1: 创建 Render 账户

1. 访问 [render.com](https://render.com)
2. 使用 GitHub 账号登录

#### 步骤 2: 创建 Web Service

1. 点击 "New +" → "Web Service"
2. 连接你的 GitHub 仓库
3. 配置如下：
   - **Name**: `wallethub-api`
   - **Root Directory**: `apps/api`
   - **Environment**: `Docker`
   - **Build Command**: `docker build -t wallethub-api -f Dockerfile .`
   - **Start Command**: (Docker 会自动处理)

#### 步骤 3: 设置环境变量

在 Render 面板的 "Environment" 中添加与 Railway 相同的环境变量。

#### 步骤 4: 部署

点击 "Create Web Service"，Render 会自动构建和部署。

---

### 选项 C: 使用 Docker 部署到任何平台

如果你已经有 VPS 或其他云平台：

```bash
# 1. 构建 Docker 镜像
docker build -t wallethub-api -f apps/api/Dockerfile .

# 2. 运行容器
docker run -d -p 3000:3000 \
  -e DATABASE_URL=你的数据库连接字符串 \
  -e HELIUS_API_KEY=你的 helius_api_key \
  -e JUPITER_API_KEY=你的 jupiter_api_key \
  -e SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=你的 helius_api_key \
  --name wallethub-api \
  wallethub-api
```

---

## 📱 第二部分：部署移动应用

### 步骤 1: 安装 EAS CLI

```bash
npm install -g eas-cli
```

### 步骤 2: 登录 Expo

```bash
cd apps/mobile
eas login
```

如果没有 Expo 账号，先注册一个。

### 步骤 3: 配置 EAS

```bash
eas init
```

选择 "Android" 平台。

### 步骤 4: 配置环境变量

编辑 `apps/mobile/.env` 或使用 EAS 环境变量：

```bash
# 方法 1: 本地 .env 文件
cd apps/mobile
cp .env.example .env

# 编辑 .env 文件，填入：
EXPO_PUBLIC_API_URL=https://你的-backend-api-url.railway.app
EXPO_PUBLIC_HELIUS_API_KEY=你的 helius_api_key
EXPO_PUBLIC_JUPITER_API_KEY=你的 jupiter_api_key
```

```bash
# 方法 2: 使用 EAS 环境变量（推荐）
eas env:push --environment preview
```

### 步骤 5: 配置 EAS Build

编辑 `apps/mobile/eas.json`，确保包含以下配置：

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 步骤 6: 构建 APK（用于测试和演示）

```bash
cd apps/mobile
eas build --profile preview --platform android
```

这会生成一个 APK 文件，你可以：
- 下载到本地
- 安装到测试设备
- 分享给评委测试

### 步骤 7: 构建 AAB（用于 Google Play，可选）

如果要提交到 Google Play：

```bash
eas build --profile production --platform android
```

### 步骤 8: 配置 Google Play 提交（可选）

1. 在 Google Play Console 创建应用
2. 生成服务账号密钥
3. 将 `service-account-key.json` 放到 `apps/mobile/` 目录
4. 提交：

```bash
eas submit --platform android --latest
```

---

## 🎬 第三部分：准备演示材料

### 演示视频（3-5 分钟）

使用 `docs/DEMO_SCRIPT.md` 作为脚本，录制演示视频：

#### 录制步骤：

1. **准备设备**
   - 清空设备通知栏
   - 调高亮度
   - 关闭所有后台应用
   - 确保电量充足

2. **录制工具**
   - Android: 使用内置屏幕录制或 AZ Screen Recorder
   - 电脑：OBS Studio

3. **录制内容**
   - 钱包连接（MWA 流程）
   - 余额显示和图表
   - 交易历史
   - 发送交易（使用生物识别）
   - 接收功能（二维码）
   - 多钱包管理

4. **添加解说**
   - 使用后期配音或实时解说
   - 强调 MWA 集成
   - 突出安全性和用户体验

### 截图准备

准备以下截图（建议 1080x1920 或更高分辨率）：

1. **启动页** - WalletHub logo
2. **钱包连接** - MWA 选择器界面
3. **主界面** - 显示余额和图表
4. **交易详情** - 单个交易详情模态框
5. **发送界面** - 发送交易表单
6. **生物识别** - 指纹/Face ID 提示
7. **接收界面** - 二维码和地址
8. **多钱包管理** - 钱包选择器

---

## 📝 第四部分：完善文档

### 更新 README.md

确保你的 README 包含：

```markdown
# WalletHub - MONOLITH Solana Mobile Hackathon

## 🏆 Hackathon 信息
- **参赛项目**: MONOLITH Solana Mobile Hackathon
- **提交链接**: [Align Hackathon 页面](https://align.nexus/organizations/.../hackathons/...)

## 🎯 项目简介
WalletHub 是一个基于 Solana Mobile Wallet Adapter (MWA) 的移动钱包聚合应用，提供：
- 多钱包管理
- 实时资产组合追踪
- 交易历史可视化
- 生物识别安全认证

## 🚀 快速开始
[保留现有的快速开始指南]

## 📱 演示
- **演示视频**: [YouTube/Loom 链接]
- **下载 APK**: [EAS Build 链接或 Google Drive 链接]

## 🛠️ 技术栈
[保留现有的技术栈说明]

## 📋 API 文档
[保留现有的 API 文档]

## 🔒 安全性
[引用 threat-model.md]

## 👥 团队信息
- **GitHub**: [你的 GitHub]
- **联系方式**: [你的邮箱]
- **Twitter**: [你的 Twitter]
```

### 创建 HACKATHON_SUBMISSION.md

已为你创建 `HACKATHON_SUBMISSION.md` 文件，包含完整的提交信息。

---

## 📤 第五部分：提交到 Align Hackathon

### 步骤 1: 访问 Align Hackathon 页面

打开你的 hackathon 页面：
```
https://align.nexus/organizations/8b216ce8-dd0e-4f96-85a1-0d95ba3022e2/hackathons/6unDGXkWmY1Yw99SsKMt6pPCQTpSSQh5kSiJRgqTwHXE
```

### 步骤 2: 准备提交内容

通常需要准备：

1. **项目名称**: WalletHub
2. **项目描述** (2-3 句话):
   ```
   WalletHub is a mobile-first Solana wallet aggregator leveraging Mobile Wallet Adapter (MWA) 
   for seamless multi-wallet management. Features include real-time portfolio tracking, 
   transaction visualization, and biometric-secured transactions.
   ```

3. **GitHub 仓库链接**: 
   ```
   https://github.com/niko4570/wallet-hub
   ```

4. **演示视频链接**:
   - 上传到 YouTube (设为不公开或公开)
   - 或使用 Loom 录制

5. **Live Demo 链接** (可选):
   - EAS Build 下载链接
   - 或 Google Play 链接

6. **截图** (3-5 张):
   - 主界面
   - 钱包连接
   - 交易详情
   - 发送界面

7. **团队信息**:
   - 团队成员
   - 联系方式
   - 社交媒体

### 步骤 3: 填写提交表单

在 Align 平台上：
1. 点击 "Submit Project" 或类似按钮
2. 填写所有必填字段
3. 上传截图
4. 添加所有链接
5. 预览并提交

### 步骤 4: 确认提交

提交后：
- 检查确认邮件
- 验证所有链接正常工作
- 确保项目页面显示正确

---

## 🎯 第六部分：投票准备

### 推广你的项目

投票从 **Mar 10, 2026** 开始，持续到 **Apr 30, 2026**。

#### 社交媒体推广
1. **Twitter/X**:
   - 发布演示视频
   - 使用 hackathon 标签
   - Tag @Solana, @SolanaMobile, @HeliusHQ, @JupiterExchange

2. **Discord**:
   - Solana Discord
   - Solana Mobile Discord
   - Hackathon 官方 Discord

3. **Reddit**:
   - r/solana
   - r/CryptoCurrency

#### 示例推文

```
🚀 Excited to announce WalletHub at #MONOLITH Hackathon!

A mobile-first Solana wallet aggregator with:
✅ MWA integration
✅ Multi-wallet management
✅ Real-time portfolio tracking
✅ Biometric security

Demo: [视频链接]
Try it: [APK 链接]

#Solana #SolanaMobile #DeFi
```

---

## ⚠️ 常见问题排查

### 后端部署问题

**Q: Railway 部署失败**
- 检查 Dockerfile 是否正确
- 查看构建日志
- 确认环境变量已设置

**Q: 数据库连接失败**
- 使用 Neon 或 Supabase 创建托管 PostgreSQL
- 检查 DATABASE_URL 格式
- 确保允许外部连接

### 移动应用问题

**Q: EAS Build 失败**
- 检查 `eas.json` 配置
- 清除缓存：`rm -rf .expo`
- 查看构建日志：`eas build:list`

**Q: 无法连接后端 API**
- 确认 EXPO_PUBLIC_API_URL 正确
- 检查 CORS 配置
- 测试 API 端点是否可访问

### 钱包连接问题

**Q: MWA 不工作**
- 确保设备已安装钱包应用（Phantom/Solflare）
- 检查 deep link 配置
- 尝试重新安装钱包应用

---

## 📞 获取帮助

如果在部署过程中遇到问题：

1. **查看文档**:
   - [Railway 文档](https://docs.railway.app/)
   - [Render 文档](https://render.com/docs)
   - [EAS Build 文档](https://docs.expo.dev/build/introduction/)

2. **检查现有文档**:
   - `docs/DEPLOYMENT.md`
   - `docs/DEMO_SCRIPT.md`
   - `README.md`

3. **社区支持**:
   - Solana Discord
   - Expo Discord
   - Railway/Render Discord

---

## ✅ 最终检查清单

在提交前，确保：

- [ ] 后端 API 已部署并可访问
- [ ] 移动应用 APK 已构建
- [ ] 所有环境变量已正确配置
- [ ] 演示视频已录制并上传
- [ ] 截图已准备
- [ ] README 已更新
- [ ] GitHub 仓库是公开的
- [ ] 所有链接都正常工作
- [ ] 已测试完整流程
- [ ] 准备好社交媒体推广

---

**祝你好运！🚀** 

如有任何问题，请随时询问！
