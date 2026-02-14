# Copilot Instructions for WalletHub

## Build, Test & Lint

- Install everything at the repo root with `npm install`; the `postinstall` hook compiles `packages/contracts` so both workspaces share the same TypeScript contracts.
- **Mobile (Expo)**  
  - Local dev: `npm run dev:mobile` (or `cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npm run start`).  
  - Device builds: `npm run android --workspace apps/mobile` / `npm run ios --workspace apps/mobile`.  
  - USB debugging on Android calls for `make adb-reverse ADB_PORT=3000` (already wired into `make android`).  
  - Type check without launching Metro via `npx tsc -p apps/mobile/tsconfig.json --noEmit`.
- **Backend (NestJS)**  
  - Local dev server: `npm run dev:api`.  
  - Build: `npm run build:api` or `npm run build` (contracts + API).  
  - Unit tests: `npm run test --workspace apps/api`. Run a single spec by appending the path, e.g. `npm run test --workspace apps/api -- src/session/session.service.spec.ts`.  
  - Lint: `npm run lint --workspace apps/api`.

## Architecture Overview

- **Monorepo layout**: `apps/mobile` (Expo React Native client), `apps/api` (NestJS service), and `packages/contracts` (shared domain models imported as `@wallethub/contracts`). Keep shared DTO/interface changes inside the contracts package first so both workspaces stay aligned.
- **Mobile client**  
  - Navigation is intentionally minimal (`navigation/AppNavigator.tsx`) with Wallet + Activity tabs only.  
  - `context/SolanaContext.tsx` + `hooks/useSolana.ts` encapsulate Mobile Wallet Adapter auth, biometric gating, and session wiring—never call adapter APIs directly from screens.  
  - All wallet/watch-only state lives in `store/walletStore.ts` (Zustand + AsyncStorage); update balances via the provided actions so historical charts and watchlists remain consistent.  
  - Data fetching flows through `services/*`:
    - `watchlistDataService` merges Jupiter portfolio snapshots, backend Helius snapshots (`/helius/accounts/...`), and local RPC fallbacks, then writes `historicalBalances`.  
    - `jupiterService`, `priceService`, and `tokenMetadataService` centralize API key usage, rate limiting, and caching.  
    - `walletService` handles biometric approval + MWA connect/disconnect semantics.  
  - UI composition: `screens/WalletScreen.tsx` renders the portfolio dashboards and watchlist management; `screens/ActivityScreen.tsx` renders the merged transaction feed with on-screen detail modals.
- **Backend service**  
  - `app.module.ts` wires feature modules:  
    - `wallets/` exposes portfolio + transaction endpoints that the mobile client consumes.  
    - `session/` manages biometric-session issuance, guards, and revocation paths.  
    - `helius/` ingests webhook + scheduled pulls, normalizes activity, and exposes `/helius/accounts/:address/*` endpoints used by the mobile aggregator.  
    - `notifications/` stores Expo push tokens and triggers mobile notifications on activity.  
    - `security/` centralizes guards (signature/nonce verification, biometric proof validation).  
  - `config/` holds typed configuration factories so new modules can extend the same environment contract.

## Key Conventions & Patterns

1. **Environment access is centralized** – `apps/mobile/src/config/env.ts` exposes `getEnv()` that throws when required `EXPO_PUBLIC_*` variables are missing. Add any new Expo env flag there rather than sprinkling `process.env` reads; remember `EXPO_PUBLIC_JUPITER_API_KEY` is mandatory for price/portfolio calls. Backend env defaults live under `apps/api/src/config`.
2. **Use shared contracts everywhere** – DTOs and type guards originate from `packages/contracts`. Import from `@wallethub/contracts` instead of duplicating interface definitions in client or server code so biometric/session payloads stay in sync.
3. **Route Solana + Jupiter traffic through services** – `watchlistDataService`, `jupiterPortfolioService`, `jupiterTransactionsService`, `priceService`, and `rpcService` embed caching, retries, and API key headers. Screen/components should dispatch store actions or call these services, never hit remote endpoints directly.
4. **State mutations go through `walletStore` actions** – whether updating balances, activity streams, or watch-only entries, prefer helpers such as `updateWatchOnlyBalance`, `updateHistoricalBalance`, and `setLinkedWallets` to keep derived totals, charts, and persisted data coherent.
5. **Biometric and session guards are mandatory for sensitive flows** – call `requireBiometricApproval` (from `security/biometrics.ts`) before linking/removing wallets and rely on `walletService` to propagate proofs to the backend’s `session` module. Avoid bypassing these helpers when adding new actions or settings.
6. **Activity feed assumptions** – `ActivityScreen` expects merged `WalletActivity[]` records (Jupiter + Helius) with a max of 50 entries and opens detail sheets locally instead of navigating; if you add new activity sources, normalize them through the existing merge helpers in `watchlistDataService`.
7. **Navigation scope is intentionally tight** – keep wallet analytics within the Wallet and Activity tabs. If you need new surfaces (e.g., settings), gate them behind the existing stack navigator rather than resurrecting removed swap/settings flows.

