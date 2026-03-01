# Copilot Instructions for WalletHub

## Build, Test & Lint

- Install everything at the repo root with `pnpm install`; the `postinstall` hook compiles `packages/contracts` so both workspaces share the same TypeScript contracts.
- **Mobile (Expo)**
  - Local dev: `pnpm run dev:mobile` (or `cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm run start`).
  - Device builds: `pnpm --filter mobile run android` / `pnpm --filter mobile run ios` (or `make android` / `make ios`).
  - USB debugging on Android calls for `make adb-reverse ADB_PORT=3000` (already wired into `make android`).
  - Type check: `make typecheck-mobile` or `pnpm exec tsc -p apps/mobile/tsconfig.json --noEmit`.
  - EAS builds: `make eas-build-dev` (development), `make eas-build-preview` (preview APK), `make eas-build-prod` (production AAB).
  - EAS submit: `make eas-submit` (submits to app stores).
- **Backend (NestJS)**
  - Local dev server: `pnpm run dev:api`.
  - Build: `pnpm run build:api` or `pnpm run build` (contracts + API).
  - Unit tests: `pnpm --filter api run test`. Run a single spec by appending the path, e.g. `pnpm --filter api run test -- src/session/session.service.spec.ts`.
  - Lint: `pnpm --filter api run lint` (or root alias `pnpm run lint`).
- **Deployment**: See `docs/DEPLOYMENT.md` for complete deployment guides (EAS, Docker, managed hosting).
- **Demo**: Follow `docs/DEMO_SCRIPT.md` for hackathon demo preparation.

## Current Core Libraries (Quick Reference)

- **Monorepo tooling**: pnpm workspaces, Turbo.
- **Mobile**: Expo `~54`, React `19`, React Native `0.81`, React Navigation `7`, Zustand `5`, Solana Mobile Wallet Adapter `2.2.5`, `@solana/web3.js` `1.98`.
- **Backend**: NestJS `11`, Prisma `7`, `pg` `8`, `joi` `18`, `uuid` `11`.
- **Shared package**: `packages/contracts` built via TypeScript and imported as `@wallethub/contracts`.

## Architecture Overview

- **Monorepo layout**: `apps/mobile` (Expo React Native client), `apps/api` (NestJS service), and `packages/contracts` (shared domain models imported as `@wallethub/contracts`). Keep shared DTO/interface changes inside the contracts package first so both workspaces stay aligned.
- **Mobile client**
  - Navigation is intentionally minimal (`navigation/AppNavigator.tsx`) with Portfolio + Activity tabs only.
  - **Mobile Wallet Adapter (MWA)** integration via `hooks/useSolana.ts`:
    - **NEVER** manually specify `walletUriBase` or `baseUri` when calling `transact()` unless targeting a specific wallet for advanced flows.
    - MWA automatically presents the system wallet chooser when multiple compatible wallets are installed.
    - Standard flow: call `transact()` → user selects wallet from system UI → authorization completes.
    - The `wallet_uri_base` in authorization results is informational only—do not use it for subsequent calls.
  - Wallet state is organized in `store/walletStore.ts` as focused Zustand slices (base, balance, activity, historical, status) persisted to AsyncStorage where needed.
  - Data fetching flows through `services/api/*` and `services/solana/*`:
    - `watchlistDataService` merges Jupiter portfolio snapshots, backend Helius snapshot/activity, and local RPC data.
    - `jupiterService`, `jupiterPortfolioService`, `priceService`, `tokenMetadataService`, `rpcService` centralize API calls, caching, and normalization.
    - `walletService` and `walletAdapterService` handle biometric approval + MWA operations.
  - UI composition:
    - `screens/PortfolioScreen.tsx`: connect-first portfolio dashboard with send/receive modals, transaction detail modal.
    - `screens/ActivityScreen.tsx`: merged transaction feed (Jupiter + Helius) with detail sheets.
    - Activity capped at 50 entries per wallet for performance.
- **Backend service**
  - `app.module.ts` wires feature modules:
    - `wallets/` exposes portfolio + transaction endpoints that the mobile client consumes.
    - `session/` manages biometric-session issuance, guards, and revocation paths.
    - `helius/` ingests webhook + scheduled pulls, normalizes activity, and exposes `/helius/accounts/:address/*` endpoints used by the mobile aggregator.
    - `notifications/` stores Expo push tokens and triggers mobile notifications on activity.
    - Security guards/verification are implemented under `security/` and consumed by feature modules (not directly imported in `app.module.ts`).
  - `config/` holds typed configuration factories so new modules can extend the same environment contract.

## Key Conventions & Patterns

1. **Environment access is centralized** – `apps/mobile/src/config/env.ts` is the only place to read Expo env vars. `getEnv()` supports defaults/fallbacks and current keys include `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_HELIUS_API_KEY`, `EXPO_PUBLIC_HELIUS_API_BASE`, `EXPO_PUBLIC_HELIUS_RPC_URL`, `EXPO_PUBLIC_JUPITER_API_KEY`, `EXPO_PUBLIC_COINGECKO_API_KEY`, `EXPO_PUBLIC_SOLANA_CLUSTER`, and optional RPC overrides (`EXPO_PUBLIC_SOLANA_RPC_URL`, `EXPO_PUBLIC_SOLANA_DEVNET_RPC_URL`, `EXPO_PUBLIC_SOLANA_TESTNET_RPC_URL`). Add new flags there rather than sprinkling `process.env` reads. Backend env defaults live under `apps/api/src/config`.

2. **Use shared contracts everywhere** – DTOs and type guards originate from `packages/contracts`. Import from `@wallethub/contracts` instead of duplicating interface definitions in client or server code so biometric/session payloads stay in sync.

3. **Mobile Wallet Adapter (MWA) rules**:
   - **Do NOT** pass `walletUriBase` or `baseUri` to `transact()` calls unless you have a specific reason to target a particular wallet.
   - The system wallet chooser is automatic—MWA handles wallet selection when multiple wallets are installed.
   - Authorization returns `wallet_uri_base` for informational purposes only; it's not needed for subsequent operations.
   - All MWA operations (authorize, reauthorize, signAndSendTransaction, signMessages, disconnect) go through `transact()`.
   - Use `walletService.normalizeAuthorization()` to convert raw authorization results to `LinkedWallet` format.

4. **Route Solana + Jupiter traffic through services** – `watchlistDataService` (account snapshots + activity), `jupiterService` / `jupiterPortfolioService`, `priceService`, `tokenMetadataService`, and `rpcService` embed retries, caching, and normalization. Screens/components should dispatch store actions or call these services, never hit remote endpoints directly.

5. **State mutations go through `walletStore` actions**:

- Wallet base: `setLinkedWallets`, `setActiveWallet`, `setActiveWalletAddress`, `setPrimaryWalletAddress`, `addWallet`, `removeWallet`, `clearAllWallets` (+ wallet group actions).
- Balances: `updateBalance`, `updateDetailedBalance`, `setMissingTokenPrices`, `updateTotalBalance`.
- Activity: `setWalletActivity(address, activities)`, `clearWalletActivity(address?)`.
- Historical: `updateHistoricalBalance`, `cleanupHistoricalBalances`, `cleanupWalletBalances`.
- Persisted slices sync to AsyncStorage via Zustand `persist` middleware.

6. **Biometric and session guards are mandatory for sensitive flows** – call `requireBiometricApproval` (from `security/biometrics.ts`) before linking/removing wallets, sending transactions, or signing messages. The helper propagates proofs to the backend's `session` module. Never bypass these guards.

7. **Activity tracking**:
   - Store activity per wallet: `walletActivity: Record<string, WalletActivity[]>`.
   - Cap at 50 entries per wallet for performance.
   - Merge Jupiter + Helius sources via `watchlistDataService.fetchAccountSnapshot()`.
   - Display in `ActivityScreen` with local detail modals (no navigation).
   - Update after send operations to reflect new transactions immediately.

8. **Send/Receive flows**:
   - Send: validate inputs → estimate fee (5000 lamports base) → require biometric → build tx → sign & send via MWA → confirm → refresh balance + activity.
   - Use max button reserves fee: `max(0, balance - feeEstimate)`.
   - Receive: display address as QR code, allow copy/share, no backend calls needed.
   - All send operations go through `useSolana.sendSol()`.

9. **Toast notifications** – use `toast.show({ message: string, type: "success" | "error" })` format. NOT callable as `toast(message, type)`.

10. **Navigation scope is intentionally tight** – keep wallet analytics within the Portfolio and Activity tabs. If you need new surfaces (e.g., settings), gate them behind the existing stack navigator. Do not add swap/trade features (out of MVP scope).
