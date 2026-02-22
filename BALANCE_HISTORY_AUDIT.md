# Balance History 代码审计报告

## 审计时间

2026-02-20

## 概述

检查了Balance History的完整实现流程，包括数据存储、更新、和显示。发现了3个关键问题和2个优化建议。

---

## 发现的问题

### 问题 1：历史数据订阅缺失（严重级）

**位置**: `apps/mobile/src/screens/WalletScreen.tsx` 第 519-600 行

**问题描述**:
在 `balanceHistoryData` 的 `useMemo` 中使用 `useWalletHistoricalStore.getState()` 同步获取状态，而不是通过 hook 订阅数据变化。这导致当历史数据更新时，组件不会重新渲染。

**当前代码**:

```typescript
const balanceHistoryData = useMemo(() => {
  // ...
  walletAddresses.forEach((address) => {
    const balances = useWalletHistoricalStore
      .getState()
      .getHistoricalBalances(address); // ❌ 未订阅数据变化
    // ...
  });
}, [primaryWalletAddress, activeWallet, linkedWallets, timeRange]); // ❌ 缺少dataVersion依赖
```

**影响**:

- 新添加的历史数据不会在图表上显示
- 切换钱包时不会更新图表
- 用户看到的数据永远是陈旧的

**解决方案**:
使用 selector hook 订阅历史数据变化。

---

### 问题 2：时间范围与数据保留期矛盾（高级）

**位置**:

- `apps/mobile/src/store/walletStore.ts` 第 402-428 行
- `apps/mobile/src/screens/WalletScreen.tsx` - 时间范围选择器

**问题描述**:
历史存储只保留过去 24 小时的数据（最多 24 个数据点），但 UI 允许用户选择 7 天或 30 天的时间范围。这导致选择 7d 或 30d 时总是显示"No balance history data available"错误。

**存储限制**:

```typescript
// walletStore.ts - updateHistoricalBalance
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
updatedBalances = updatedBalances.filter(
  (item) => item.timestamp >= oneDayAgo, // ❌ 硬编码24小时限制
);

const MAX_DATA_POINTS = 24; // ❌ 最多24个数据点
if (updatedBalances.length > MAX_DATA_POINTS) {
  updatedBalances = updatedBalances.slice(-MAX_DATA_POINTS);
}
```

**UI提供的时间范围**:

```typescript
// WalletScreen.tsx
const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

const getTimeRangeMs = () => {
  switch (timeRange) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000; // ❌ 7天数据不存在
    case "30d":
      return 30 * 24 * 60 * 60 * 1000; // ❌ 30天数据不存在
  }
};
```

**影响**:

- 用户无法查看7天或30天的历史数据
- 频繁出现"No balance history data available"错误
- UI选项形同虚设

**解决方案**:
根据实现能力调整：

- **方案A**（推荐）: 扩大数据保留期到 30 天，并根据时间范围调整数据点数量
- **方案B**: 删除 7d 和 30d 选项，只保留 24h

---

### 问题 3：数据更新时不刷新UI（高级）

**位置**: `apps/mobile/src/screens/WalletScreen.tsx` 第 113-115 行

**问题描述**:
`balanceHistoryLoading` 状态被初始化但从未真正使用或更新。当调用 `fetchAccountSnapshot` 时，没有设置加载状态。

**当前代码**:

```typescript
const [balanceHistoryLoading, setBalanceHistoryLoading] = useState(false);
// ❌ 这个状态从未被更新
// balanceHistoryData 的 useMemo 中也没有使用它
```

**影响**:

- 用户看不到数据加载进度
- 无法区分"加载中"和"加载失败"
- 体验不良

---

## 优化建议

### 建议 1：添加数据校验

在 `updateHistoricalBalance` 中添加数据验证：

```typescript
if (!Number.isFinite(balance.usd) || balance.usd < 0) {
  console.warn("Invalid USD value:", balance.usd);
  return;
}
if (!Number.isFinite(balance.sol) || balance.sol < 0) {
  console.warn("Invalid SOL value:", balance.sol);
  return;
}
```

### 建议 2：添加调试日志

在关键位置添加日志，便于诊断问题：

```typescript
// walletStore.ts - updateHistoricalBalance
console.debug("Updating historical balance:", { address, balance });

// WalletScreen.tsx - balanceHistoryData
console.debug("Balance history data fetched:", balanceHistoryData.length);
```

---

## 测试建议

### 单元测试

- [ ] `updateHistoricalBalance`: 验证数据排序和限制
- [ ] `getHistoricalBalances`: 验证正确返回地址的数据
- [ ] `cleanupHistoricalBalances`: 验证过期数据清理

### 集成测试

- [ ] 连接钱包后，历史数据是否开始记录
- [ ] 切换时间范围时，图表是否正确更新
- [ ] 切换钱包时，图表是否显示正确的数据
- [ ] 7d/30d 模式下是否有数据或正确的错误提示

### 端到端测试

- [ ] 打开应用 → 连接钱包 → 等待 5 分钟 → 图表应显示数据
- [ ] 连接多个钱包 → 图表应显示合并的历史数据

---

## 代码流程图

```
fetchAccountSnapshot()
    ↓
walletHistoricalStore.updateHistoricalBalance()
    ↓ (可能的问题：更新不被订阅)
useWalletHistoricalStore (数据存储)
    ↓
WalletScreen.balanceHistoryData (使用getState()而非hook) ❌
    ↓
balanceHistoryData 状态 (依赖缺失，不会重新渲染)
    ↓
BalanceChart 组件 (显示陈旧数据)
```

---

## 修复优先级

1. **紧急**: 修复状态订阅（问题1）
2. **高**: 解决时间范围矛盾（问题2）
3. **高**: 实现加载状态管理（问题3）
4. **中**: 添加数据校验和日志（建议1-2）

---

## 检查清单

- [x] 代码流程分析
- [x] 存储实现检查
- [x] UI绑定检查
- [x] 数据更新路径检查
- [ ] 修复实现（待进行）
- [ ] 测试验证（待进行）
