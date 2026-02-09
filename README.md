# WalletHub Monorepo

Solana-native mobile wallet hub targeting the MONOLITH Solana Mobile Hackathon. The repo hosts a frontend Expo app plus a NestJS backend and shared TypeScript contracts that model wallet aggregation, session keys, and security policies.

## Structure

```
apps/
  mobile/    # Expo React Native client
  api/       # NestJS backend (wallet aggregation + session service)
packages/
  contracts/ # Shared TypeScript domain contracts
```

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

   `postinstall` builds the shared contracts package so the Expo bundler can import it.

2. **Environment variables**
   - Backend: optional `PORT` (defaults to `3000`).
   - Mobile: set `EXPO_PUBLIC_API_URL` to point at the running backend (e.g. `http://localhost:3000` or your LAN IP).

3. **Run services**

   ```bash
   # Backend API (http://localhost:3000)
   npm run dev:api

   # Mobile app (Expo)
   cd apps/mobile
   EXPO_PUBLIC_API_URL=http://localhost:3000 npm run start
   ```

   - **USB device debugging**: First run `make adb-reverse ADB_PORT=3000` (or directly `make android`, which will call it automatically) to map the phone's `tcp:3000` to the host machine port, then keep `EXPO_PUBLIC_API_URL=http://localhost:3000`.

4. **Mobile environment notes**
   - Tamagui config is consumed from `apps/mobile/tamagui.config.js` (CJS). If Metro warns about the TS config, clear cache: `cd apps/mobile && rm -rf .expo && npx expo start -c`.
   - Solana RPC: set `EXPO_PUBLIC_HELIUS_API_KEY` or override `EXPO_PUBLIC_RPC_URL` via `apps/mobile/src/config/env.ts` to point at your node.
   - Sensitive wallet actions (connect, send, session management) now require biometric approval via Expo Local Authentication.
   - Security posture, threat model, and assumptions live in [`docs/threat-model.md`](./docs/threat-model.md).

## API Surface

| Method | Path                  | Description                               |
| ------ | --------------------- | ----------------------------------------- |
| GET    | `/health`             | Health probe                              |
| GET    | `/wallets`            | Aggregated wallet + balance snapshot      |
| POST   | `/wallets/link`       | Link/import wallet metadata               |
| GET    | `/session`            | List session keys & statuses              |
| GET    | `/session/policies`   | List policy definitions                   |
| POST   | `/session/issue`      | Issue scoped session key (biometric flow) |
| PATCH  | `/session/:id/revoke` | Revoke a session key                      |
| DELETE | `/session/:id`        | Revoke via delete                         |

The backend currently uses in-memory stores plus sample Helius-style balances, enabling fast hackathon iterations. The shared contracts (`@wallethub/contracts`) define wallet, session, and policy interfaces consumed by both the API and mobile UI.

## Testing & Build

- `npm run build:api` – compile NestJS API.
- `npm run build:contracts` – compile shared domain package (runs on `postinstall`).
- `npm run test --workspace apps/api` – execute backend unit tests.

## Next Steps

- Replace mock wallet data with live Solana RPC aggregation (Helius/QuickNode).
- Integrate MPC provider support for session issuance (biometric gating now ships on-device).
- Extend Expo UI with onboarding, activity feed, and device trust center.
