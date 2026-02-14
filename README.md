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
   - Backend:
     - `PORT` (defaults to `3000`).
     - `DATABASE_URL` (defaults to `postgresql://postgres:postgres@localhost:5432/wallethub`; point this at Neon/Supabase for managed Postgres).
     - `SOLANA_RPC_URL` (optional override; falls back to `https://mainnet.helius-rpc.com/?api-key=HELIUS_API_KEY` or `https://api.mainnet-beta.solana.com`).
     - `SOLANA_PRIORITY_RPC_URL` (optional, defaults to the main RPC endpoint).
     - `HELIUS_API_KEY` (optional, used to derive the managed Helius RPC URL when no explicit RPC is provided).
    - Mobile:
      - `EXPO_PUBLIC_API_URL` to point at the running backend (e.g. `http://localhost:3000` or your LAN IP).
      - `EXPO_PUBLIC_HELIUS_API_KEY` for on-device Solana RPC access.
      - `EXPO_PUBLIC_JUPITER_API_KEY` is **required** for Jupiter portfolio/price/token APIs (`/portfolio/v1/wallet`, `/price/v3/price`, `/tokens/v2`). Request a key from [Jupiter’s developer portal](https://dev.jup.ag/) and keep it scoped per environment.
      - `JUPITER_API_KEY` (API service) falls back to the Expo key if unset; set it when deploying the Nest backend so `/wallets` endpoints can hydrate data directly from Jupiter without hitting the client.
      - Optional WebView integrations: `EXPO_PUBLIC_JUPITER_PLUGIN_URL`, `EXPO_PUBLIC_JUPITER_PLUGIN_ALLOWLIST`, `EXPO_PUBLIC_TELEMETRY_URL`.

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
   - **Wallet connection behavior**: Some wallet apps like Phantom may only return one account by default. To connect multiple accounts:
     - Ensure you have created multiple accounts in your wallet app
     - When reconnecting, look for an account selection interface
     - If no selection interface appears, try using a different wallet app that supports multi-account connections
     - The app is designed to support multiple accounts, but the actual number of accounts returned depends on the wallet app's implementation.

## Dockerized API

Run the NestJS backend inside a container using the multi-stage image defined at `apps/api/Dockerfile`.

```bash
# Build the API image
docker build -t wallethub-api -f apps/api/Dockerfile .

# Run against managed Neon/Supabase + Helius RPC endpoints
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/wallethub \
  -e SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY} \
  wallethub-api
```

The container only needs database/RPC credentials via environment variables; health checks expose a sanitized view of the configured infrastructure so you can confirm which managed services are in use.

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

`POST /session/issue` requires a biometric attestation payload (`biometricProof`) alongside `walletAddress`, `devicePublicKey`, scopes, and expiry data. The API currently accepts base64-encoded JSON proofs (method, deviceId, confidence) while remaining agnostic to future MPC/attestation providers, and now routes every issuance through an MPC/multi-sig signer abstraction that enforces policy limits before returning a signature identifier.

The backend currently uses in-memory stores plus sample Helius-style balances, enabling fast hackathon iterations. The shared contracts (`@wallethub/contracts`) define wallet, session, and policy interfaces consumed by both the API and mobile UI.

## Testing & Build

- `npm run build:api` – compile NestJS API.
- `npm run build:contracts` – compile shared domain package (runs on `postinstall`).
- `npm run test --workspace apps/api` – execute backend unit tests.

## Next Steps

- Replace mock wallet data with live Solana RPC aggregation (Helius/QuickNode).
- Swap the mocked MPC signer abstraction with a real provider integration once credentials are provisioned.
- Extend Expo UI with onboarding, activity feed, and device trust center.
