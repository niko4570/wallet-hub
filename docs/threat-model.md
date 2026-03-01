# WalletHub Threat Model & Security Assumptions

## Scope & Assets

- **Mobile client (Expo RN)**: Handles wallet connection via Solana Mobile Wallet Adapter (MWA), biometric gating, secure API request signing, and send flow orchestration.
- **API + Session services (NestJS)**: Issue/revoke session keys, validate biometric proof payloads, enforce request security guard controls, and accept audit events.
- **On-chain interactions**: Solana RPC through configured endpoints (mainnet default; testnet/devnet override supported by env).

High-value assets:

1. User wallets (secret keys live in trusted wallets, never inside WalletHub).
2. Session keys and wallet authorization tokens.
3. Policy definitions and security telemetry (silent reauth + transaction audit records).
4. Transaction intents (destinations, amounts).

## Trust Boundaries

| Boundary             | Description                 | Controls                                                                                                                                                                                             |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device ↔ Wallet App  | MWA deep link / intent      | Wallet verifies dApp identity; WalletHub never sees seed phrases.                                                                                                                                    |
| Device ↔ Backend     | JSON APIs + typed contracts | HTTPS/localhost URL validation on mobile, wallet-signed write requests (`x-wallet-*` headers), nonce + body-hash replay protection, optional API key gate, body-size limit, in-memory rate limiting. |
| Backend ↔ Solana RPC | RPC endpoints + API keys    | URL configuration centralized via infra config; expected to run over HTTPS endpoints.                                                                                                                |

## Threat Agents

- Remote attacker attempting API abuse, replaying signed requests, or brute-forcing unauthenticated endpoints.
- Malicious client/wallet integration sending malformed addresses, signatures, or request payloads.
- Compromised device or shoulder-surfer trying to trigger wallet actions without biometric approval.
- Backend insider or infrastructure compromise manipulating session policies.
- Network adversary attempting endpoint spoofing/downgrade (partially mitigated; certificate pinning not yet implemented).

## Assumptions

1. Users install WalletHub mobile client from trusted source and keep OS updated.
2. Wallet private keys remain inside Solana wallets (Seed Vault, Phantom, Backpack, etc.).
3. Device Secure Enclave/TEE enforces biometric factors; LocalAuthentication reports accurate enrollment state.
4. Backend secrets (RPC keys, session API key, signing metadata) are managed securely by deployment environment.
5. Current MPC signer logic is service-level policy + biometric approval logic, not yet external threshold cryptography infrastructure.

## Current Mitigations

- **Biometric gating in mobile** using `expo-local-authentication` for sensitive actions (wallet connect/register/remove/sign/send), with short-lived local approval reuse window.
- **Wallet-signed backend writes** in mobile authorization API client: canonical message signing (`WalletHub|METHOD|PATH|NONCE|BODY_HASH`) with `x-wallet-*` headers.
- **Backend request security guard** on `/session/*`: optional API key enforcement, body-size cap, per-client in-memory rate limiting, signature verification (`tweetnacl` + base58 pubkey), nonce replay cache with TTL, and body-hash integrity checks.
- **Backend biometric proof validation** for session issuance: base64 payload parsing, JSON schema-like field checks, max-age validation, and minimum confidence threshold.
- **Session key lifecycle controls**: feature flag gate (`SESSION_KEYS_ENABLED`, default false), issue/revoke paths, and hourly cron cleanup for expired active keys.
- **Session scope/policy checks** in MPC signer service: scope non-empty, confidence minimum, daily spend and allowlist checks against session policy.
- **Security telemetry endpoints** for silent reauthorization and transaction audits are active, but currently in-memory capped buffers (non-durable).
- **Network URL validation on mobile** enforces HTTPS (with localhost/private-IP exceptions in non-production) before fetch.

## Known Gaps / Residual Risk

1. **Audit persistence gap**: silent reauth and transaction audit records are stored in process memory only; restarts lose history.
2. **Rate-limit durability gap**: in-memory limiter and nonce cache are per-instance; distributed deployments need shared state.
3. **Transport hardening gap**: no certificate pinning/mTLS yet for mobile↔backend or backend↔RPC links.
4. **MPC maturity gap**: current signer is policy-driven service logic; production threshold signing/HSM/MPC provider integration is pending.
5. **Best-effort telemetry**: mobile catches and logs failures when posting audit events, so some events may be dropped during outages.

## Planned Controls

1. **Durable security telemetry** (DB-backed audit + silent reauth records) with retention policy and query tooling.
2. **Distributed request protection** using shared nonce/rate-limit stores (e.g., Redis) for multi-instance backends.
3. **Certificate pinning / stronger transport controls** for mobile API calls and hardened RPC connectivity.
4. **Production-grade MPC/threshold signer integration** with key custody controls and explicit trust boundaries.
5. **On-chain session registry + revocation anchoring** and richer policy evaluation before transaction relay.
6. **Anomaly detection pipeline** that streams telemetry into SIEM for automated alerting and incident response.

## Compliance & Privacy Notes

- WalletHub does not store wallet private keys or raw biometric templates.
- Backend stores session metadata/policy and security telemetry needed for authorization and auditing.
- Session key issuance is environment-gated (`SESSION_KEYS_ENABLED`) and revocable in backend APIs.
- Future milestones: SOC2-aligned controls, GDPR/CCPA export/deletion workflows, and formal DPA review for external custody/MPC providers.
