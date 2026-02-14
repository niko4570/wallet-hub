# Monolith Hackathon Execution Plan

## Problems & Objectives

- Transform WalletHub (Expo RN + NestJS) into a Monolith Hackathon entry: a mobile Solana account tracking dApp.
- Support primary wallet registration via Mobile Wallet Adapter (MWA) + biometrics, allowing manual addition of watch-only public keys.
- Real-time tracking of account assets/tokens/transactions (Helius webhook + API), with balance curves and token pie charts on mobile, supplemented by notifications, haptics, and dark theme.

## Official Documentation Links

### Core Technologies

- **Solana Mobile Wallet Adapter (MWA)**: https://github.com/solana-mobile/mobile-wallet-adapter/blob/main/js/packages/wallet-adapter-mobile/README.md
- **Helius API**: https://www.helius.dev/docs/data-streaming/quickstart
- **Victory Native (Chart Library)**: https://github.com/formidablelabs/victory/blob/main/packages/victory-native/README.md

### Reference Documentation

- **Helius Webhooks**: https://www.helius.dev/docs/api-reference/webhooks/get-all-webhooks
- **Helius RPC Balance**: https://www.helius.dev/docs/rpc/guides/getbalance
- **Victory Native Guide**: https://github.com/formidablelabs/victory/blob/main/website/docs/introduction/native.mdx

## Existing Code Structure & Reusable Components (5-8)

1. `apps/mobile/src/screens/WalletScreen.tsx`: Displays assets, send/receive, account card logic; can be extended as main dashboard and watch-only list.
2. `apps/mobile/src/services/walletService.ts`: Encapsulates MWA authorization, biometric verification, and balance queries; can be reused as main wallet registration flow entry.
3. `apps/mobile/src/context/SolanaContext.tsx` + `apps/mobile/src/hooks/useSolana.ts`: Centralizes authorization, detection, sending methods; suitable for extending watch-only imports, Helius subscription-triggered refreshes.
4. `apps/mobile/src/store/walletStore.ts`: Zustand state, already stores `linkedWallets`, balances, tokens; can add `watchOnlyAccounts`, `activityFeed`.
5. `apps/mobile/src/services/tokenMetadataService.ts` + `priceService.ts`: Handles token/price data; can be reused as data aggregation layer for watch-only accounts.
6. `apps/api/src/wallets/*` + `apps/api/src/session/*`: NestJS service modules with session security, wallet linking capabilities; can host Helius webhooks, balance/transaction history APIs.
7. `apps/api/src/security/*`: Existing biometric and MPC guards; can continue to be used for registration verification and sensitive operations.

## Current Progress

- ✅ A1: Completed `walletStore` primary wallet fields, `useSolana.registerPrimaryWallet`, WalletScreen primary wallet UX (send/receive constrained by primary wallet).
- ✅ A2: Implemented watch-only state (Zustand persistence), `WatchOnlyForm`, `watchlistDataService`, and Watchlist UI/refresh/remove.
- ✅ B1: Helius webhook inbound, activity in-memory cache, and `/wallets/:address/activity` API.
- ✅ B2: Nest scheduled polling + `/helius/accounts/:address/snapshot`, client unified through backend snapshot and write-back to `activityFeed`.
- ✅ C1/C2: Built visualization components and displayed snapshot + activity data on main screen.

## Epic → Feature → Task Breakdown

### Epic A: Secure Registration & Account Aggregation

#### Feature A1: MWA Primary Wallet Registration & Biometrics

- **Task A1.1 – Extend `useSolana` Registration Context**
  - Files: `apps/mobile/src/context/SolanaContext.tsx`, `apps/mobile/src/hooks/useSolana.ts`, `apps/mobile/src/store/walletStore.ts`
  - Code: Add `registerPrimaryWallet()`, mark `primaryWalletId`, biometric status in Zustand, reuse `walletService.startWalletAuthorization`.
  - Dependencies: None new.
  - Estimated: ~2h.
- **Task A1.2 – WalletScreen Registration UX**
  - Files: `apps/mobile/src/screens/WalletScreen.tsx`, `apps/mobile/src/components/wallet/WalletOption.tsx`
  - Code: Add "Set as Primary Wallet" path in top card, lock send/receive to require primary wallet; provide read-only labels for watch-only accounts.
  - Dependencies: `expo-haptics` already present.
  - Estimated: ~1.5h.

#### Feature A2: Manual Watch-Only Public Key Addition

- **Task A2.1 – Watch-Only Input Form Component**
  - Files: `apps/mobile/src/components/watchlist/WatchOnlyForm.tsx` (new), `WalletScreen.tsx`
  - Code: Validate base58, public key duplicates, call `walletStore.addWatchOnlyAccount()`; provide naming, labels.
  - Dependencies: Reusable `@solana/web3.js` PublicKey validation.
  - Estimated: ~2h.
- **Task A2.2 – Zustand Store Extension**
  - Files: `apps/mobile/src/store/walletStore.ts`
  - Code: Add `watchOnlyAccounts[]`, `upsertAccountSnapshot(address, snapshot)`, persist to AsyncStorage.
  - Dependencies: `zustand/middleware` (already in project, if not `yarn add zustand`).
  - Estimated: ~1.5h.

### Epic B: Real-Time Data Ingestion (Helius)

#### Feature B1: Helius Webhook → API Inbound

- **Task B1.1 – NestJS Helius Module**
  - Files: `apps/api/src/helius/helius.module.ts` (new), `helius.controller.ts`, `helius.service.ts`
  - Code: Expose `/helius/webhook` endpoint for signature verification, parse balance/tx events, write to Prisma/in-memory storage (for MVP can use Redis/in-memory map).
  - Dependencies: `npm install @helius-labs/helius-sdk` (or pure HTTP).
  - Estimated: ~3h.
- **Task B1.2 – Push to Client Subscriptions**
  - Files: `apps/api/src/wallets/wallets.service.ts`, `apps/api/src/wallets/wallets.controller.ts`
  - Code: Add `/wallets/:address/activity` SSE/long-poll + cache layer for client polling.
  - Dependencies: `@nestjs/event-emitter` (if needed).
  - Estimated: ~2h.

#### Feature B2: Helius API Scheduled Incremental Updates

- **Task B2.1 – Backend Cron Pull**
  - Files: `apps/api/src/helius/helius.service.ts`, `apps/api/src/app.module.ts`
  - Code: Use `@nestjs/schedule` to periodically refresh balances/tx as webhook fallback.
  - Dependencies: `npm install @nestjs/schedule`.
  - Estimated: ~1.5h.
- **Task B2.2 – Client Data Merger**
  - Files: `apps/mobile/src/services/watchlistDataService.ts` (new), `walletStore.ts`
  - Code: Unified `fetchAccountSnapshot(address)`, integrate RPC + API responses, update `activityFeed`.
  - Dependencies: None.
  - Estimated: ~2h.

### Epic C: Data Visualization & Mobile Experience

#### Feature C1: Balance History Curve

- **Task C1.1 – Chart Component**
  - Files: `apps/mobile/src/components/analytics/BalanceChart.tsx` (new)
  - Code: Use `victory-native` or `recharts` (web); mobile recommended `victory-native` + `react-native-svg` (already installed).
  - Dependencies: `expo install victory-native react-native-svg@~15.12.1 react-native-gesture-handler`.
  - Estimated: ~2h.
- **Task C1.2 – Data Pipeline**
  - Files: `watchlistDataService.ts`, `walletStore.ts`
  - Code: Maintain `historicalBalances[address]` (array {timestamp, usd, sol}), provide selector for Chart use.
  - Estimated: ~1h.

#### Feature C2: Token Holdings Pie Chart + Change Log

- **Task C2.1 – Token Pie Chart**
  - Files: `apps/mobile/src/components/analytics/TokenPie.tsx`
  - Code: Use `victory-native`'s `VictoryPie` to display top-N tokens, others aggregated.
  - Dependencies: Same as C1.
  - Estimated: ~1.5h.
- **Task C2.2 – Activity Log UI**
  - Files: `WalletScreen.tsx`, new `ActivityList.tsx`
  - Code: Render webhook events (transactions, token changes), support filtering watch-only vs primary wallet.
  - Estimated: ~2h.

### Epic D: Mobile Native Experience & Notifications

#### Feature D1: Push Notifications + Haptics

- **Task D1.1 – Expo Notifications Layer**
  - Files: `apps/mobile/src/services/notificationService.ts`, `WalletScreen.tsx`
  - Code: Request permissions, register push token, listen for websocket/SSE events to trigger local notifications + Haptics.
  - Dependencies: `expo install expo-notifications`.
  - Estimated: ~2h.
- **Task D1.2 – Backend Notification Bridge**
  - Files: `apps/api/src/notifications/notifications.module.ts` (new)
  - Code: Store device tokens, Helius events trigger Expo push (using Expo Push SDK).
  - Dependencies: `npm install @expo/server-sdk`.
  - Estimated: ~2h.

### Epic E: Security & Experience Enhancements

#### Feature E1: Biometric Policy Enforcement

- **Task E1.1 – Session Guard**
  - Files: `apps/mobile/src/security/biometrics.ts`, `walletService.ts`
  - Code: Add `requireBiometricApproval` for sensitive operations (add primary wallet, delete watch-only).
  - Estimated: ~1h.
- **Task E1.2 – API Session Guard**
  - Files: `apps/api/src/security/session-security.guard.ts`
  - Code: Extend guard, require primary wallet operations to include signature/nonce.
  - Estimated: ~1.5h.

## Workplan (MVP Tracking)

- [x] A1 – Primary wallet registration & biometric path
- [x] A2 – Watch-only input & state storage
- [x] B1 – Helius webhook inbound & push
- [x] B2 – Account snapshot aggregation service
- [x] C1 – Balance curve component
- [x] C2 – Token pie chart + Activity list
- [x] D1 – Notification & Haptics pipeline
- [x] E1 – Biometric policy enforcement

## Hackathon Bonus Focus Points

1. **Mobile-native**: Continue strengthening `WalletScreen` as an immersive dashboard, using Haptics, Gestures, dark glass UI.
2. **Helius real-time**: Webhook + SSE + notifications form a real-time loop, all changes <5s sync.
3. **Biometric security**: Registration, removal, sensitive settings all require biometrics, demonstrating security policy.
4. **Visualization UX**: Display curves/pie charts, activity streams on main screen; use gradients, animations to emphasize changes.
5. **Offline/cache**: Zustand + AsyncStorage cache historical data, ensuring browsing is possible with poor network.
6. **Observability**: Backend records events, enabling "security logs" display during demo.

## 7-10 Day Development Roadmap

| Day      | Goal                                                                                 |
| ------- | ------------------------------------------------------------------------------------ |
| Day 1   | Align requirements, complete A1/A2 design, build watch-only store and form skeleton. |
| Day 2   | Complete primary wallet registration UX (A1.2), watch-only input (A2.1), integrate AsyncStorage. |
| Day 3   | Implement Helius module and webhook (B1.1), configure dev webhook, start client data service (B2.2). |
| Day 4   | Complete SSE/polling API (B1.2) and backend cron fallback (B2.1), client merge logic ready. |
| Day 5   | Build balance curve, token pie chart components (C1/C2), connect to real data. |
| Day 6   | Implement Activity log, change log UI; polish states/empty states. |
| Day 7   | Add notifications + Haptics (D1), biometric policies (E1), self-test and fix bugs. |
| Day 8-9 | Performance/stability optimization, prepare demo data scripts, screen recording. |
| Day 10  | Final inspection: end-to-end demo, backup plan, submission materials. |

## Hackathon Submission Checklist

- [ ] EAS Build / TestFlight (with primary wallet + watch-only demo accounts).
- [ ] Backend deployment (Render/Fly/Heroku) + Helius webhook pointing to production URL.
- [ ] Demo script: register → add watch-only → real-time trigger → view charts/logs → notification replay.
- [ ] Screen recording + screenshots (including visualization and notifications).
- [ ] README / Pitch document: architecture diagram, technical highlights, Helius + biometric value.
- [ ] Environment variables and API key list (Helius, RPC, Expo Push).
- [ ] Monitoring dashboard/log sample screenshots (proving real-time and security events).
