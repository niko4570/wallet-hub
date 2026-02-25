# Copilot Instructions for WalletHub

## Build, Test & Lint

- Install everything at the repo root with `npm install`; the `postinstall` hook compiles `packages/contracts` so both workspaces share the same TypeScript contracts.
- **Mobile (Expo)**  
  - Local dev: `npm run dev:mobile` (or `cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npm run start`).  
  - Device builds: `npm run android --workspace apps/mobile` / `npm run ios --workspace apps/mobile`.  
  - USB debugging on Android calls for `make adb-reverse ADB_PORT=3000` (already wired into `make android`).  
  - Type check: `make typecheck-mobile` or `npx tsc -p apps/mobile/tsconfig.json --noEmit`.
  - EAS builds: `make eas-build-dev` (development), `make eas-build-preview` (preview APK), `make eas-build-prod` (production AAB).
  - EAS submit: `make eas-submit` (submits to app stores).
- **Backend (NestJS)**  
  - Local dev server: `npm run dev:api`.  
  - Build: `npm run build:api` or `npm run build` (contracts + API).  
  - Unit tests: `npm run test --workspace apps/api`. Run a single spec by appending the path, e.g. `npm run test --workspace apps/api -- src/session/session.service.spec.ts`.  
  - Lint: `npm run lint --workspace apps/api`.
- **Deployment**: See `docs/DEPLOYMENT.md` for complete deployment guides (EAS, Docker, managed hosting).
- **Demo**: Follow `docs/DEMO_SCRIPT.md` for hackathon demo preparation.

## Architecture Overview

- **Monorepo layout**: `apps/mobile` (Expo React Native client), `apps/api` (NestJS service), and `packages/contracts` (shared domain models imported as `@wallethub/contracts`). Keep shared DTO/interface changes inside the contracts package first so both workspaces stay aligned.
- **Mobile client**  
  - Navigation is intentionally minimal (`navigation/AppNavigator.tsx`) with Wallet + Activity tabs only.  
  - **Mobile Wallet Adapter (MWA)** integration via `hooks/useSolana.ts`:
    - **NEVER** manually specify `walletUriBase` or `baseUri` when calling `transact()` unless targeting a specific wallet for advanced flows.
    - MWA automatically presents the system wallet chooser when multiple compatible wallets are installed.
    - Standard flow: call `transact()` → user selects wallet from system UI → authorization completes.
    - The `wallet_uri_base` in authorization results is informational only—do not use it for subsequent calls.
  - All wallet state lives in `store/walletStore.ts` (Zustand + AsyncStorage):
    - Linked wallets: `linkedWallets` array with address, label, publicKey, authToken.
    - Activity tracking: `walletActivity: Record<string, WalletActivity[]>` maps address → activity array.
    - Actions: `setLinkedWallets`, `updateDetailedBalance`, `updateHistoricalBalance`, `setWalletActivity`, `clearWalletActivity`.
    - Store version 5 schema; migrations auto-run on version bump.
  - Data fetching flows through `services/*`:
    - `watchlistDataService` merges Jupiter portfolio snapshots, backend Helius data, and local RPC calls.  
    - `jupiterService`, `priceService`, `tokenMetadataService` centralize API key usage, rate limiting, caching.  
    - `walletService` handles biometric approval + MWA authorization/reauthorization.
    - `walletConnectionService`, `walletAdapterService` abstract MWA operations.
  - UI composition:
    - `screens/WalletScreen.tsx`: connect-first portfolio dashboard with send/receive modals, transaction detail modal.
    - `screens/ActivityScreen.tsx`: merged transaction feed (Jupiter + Helius) with detail sheets.
    - Activity capped at 50 entries per wallet for performance.
- **Backend service**  
  - `app.module.ts` wires feature modules:  
    - `wallets/` exposes portfolio + transaction endpoints that the mobile client consumes.  
    - `session/` manages biometric-session issuance, guards, and revocation paths.  
    - `helius/` ingests webhook + scheduled pulls, normalizes activity, and exposes `/helius/accounts/:address/*` endpoints used by the mobile aggregator.  
    - `notifications/` stores Expo push tokens and triggers mobile notifications on activity.  
    - `security/` centralizes guards (signature/nonce verification, biometric proof validation).  
  - `config/` holds typed configuration factories so new modules can extend the same environment contract.

## Key Conventions & Patterns

1. **Environment access is centralized** – `apps/mobile/src/config/env.ts` exposes `getEnv()` that throws when required `EXPO_PUBLIC_*` variables are missing. Required vars: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_JUPITER_API_KEY`, `EXPO_PUBLIC_SOLANA_RPC_URL`, `EXPO_PUBLIC_SOLANA_NETWORK`. Add any new Expo env flag there rather than sprinkling `process.env` reads. Backend env defaults live under `apps/api/src/config`.

2. **Use shared contracts everywhere** – DTOs and type guards originate from `packages/contracts`. Import from `@wallethub/contracts` instead of duplicating interface definitions in client or server code so biometric/session payloads stay in sync.

3. **Mobile Wallet Adapter (MWA) rules**:
   - **Do NOT** pass `walletUriBase` or `baseUri` to `transact()` calls unless you have a specific reason to target a particular wallet.
   - The system wallet chooser is automatic—MWA handles wallet selection when multiple wallets are installed.
   - Authorization returns `wallet_uri_base` for informational purposes only; it's not needed for subsequent operations.
   - All MWA operations (authorize, reauthorize, signAndSendTransaction, signMessages, disconnect) go through `transact()`.
   - Use `walletService.normalizeAuthorization()` to convert raw authorization results to `LinkedWallet` format.

4. **Route Solana + Jupiter traffic through services** – `watchlistDataService` (account snapshots + activity), `jupiterPortfolioService`, `jupiterTransactionsService`, `priceService`, and `rpcService` embed caching, retries, and API key headers. Screens/components should dispatch store actions or call these services, never hit remote endpoints directly.

5. **State mutations go through `walletStore` actions**:
   - Wallets: `setLinkedWallets`, `addWallet`, `removeWallet`, `updateWallet`.
   - Balances: `updateDetailedBalance`, `updateHistoricalBalance`.
   - Activity: `setWalletActivity(address, activities)`, `clearWalletActivity(address?)`.
   - All mutations persist to AsyncStorage automatically via Zustand middleware.
   - Store migrations run on version bump (current version: 5).

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

10. **Navigation scope is intentionally tight** – keep wallet analytics within the Wallet and Activity tabs. If you need new surfaces (e.g., settings), gate them behind the existing stack navigator. Do not add swap/trade features (out of MVP scope).
