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

## API Surface

| Method | Path              | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| GET    | `/health`         | Health probe                               |
| GET    | `/wallets`        | Aggregated wallet + balance snapshot       |
| POST   | `/wallets/link`   | Link/import wallet metadata                |
| GET    | `/session`        | List session keys & statuses               |
| GET    | `/session/policies` | List policy definitions                  |
| POST   | `/session/issue`  | Issue scoped session key (biometric flow)  |
| PATCH  | `/session/:id/revoke` | Revoke a session key                   |
| DELETE | `/session/:id`    | Revoke via delete                          |

The backend currently uses in-memory stores plus sample Helius-style balances, enabling fast hackathon iterations. The shared contracts (`@wallethub/contracts`) define wallet, session, and policy interfaces consumed by both the API and mobile UI.

## Testing & Build

- `npm run build:api` – compile NestJS API.
- `npm run build:contracts` – compile shared domain package (runs on `postinstall`).
- `npm run test --workspace apps/api` – execute backend unit tests.

## Next Steps

- Replace mock wallet data with live Solana RPC aggregation (Helius/QuickNode).
- Add biometric & MPC provider integrations for session issuance.
- Extend Expo UI with onboarding, activity feed, and device trust center.
