# WalletHub Threat Model & Security Assumptions

## Scope & Assets

- **Mobile client (Expo RN)**: Handles wallet connection via Solana Mobile Wallet Adapter (MWA), biometric gating, balance display, and send flow orchestration.
- **API + Session Services (NestJS)**: Issue/revoke session keys, store wallet metadata, enforce policies, and relay Solana transactions.
- **On-chain interactions**: Solana mainnet-beta RPC via Helius.

High-value assets:
1. User wallets (secret keys live in trusted wallets, never inside WalletHub).
2. Session keys/tokens issued by backend.
3. Policy definitions & audit logs.
4. Transaction intents (destinations, amounts).

## Trust Boundaries

| Boundary | Description | Controls |
| --- | --- | --- |
| Device ↔ Wallet App | MWA deep link / intent | Wallet verifies dApp identity; WalletHub never sees seed phrases. |
| Device ↔ Backend | HTTPS JSON APIs + typed contracts | Access tokens/session keys, TLS pinning (planned). |
| Backend ↔ Solana RPC | Helius RPC key | API key stored server-side, rate limited. |

## Threat Agents

- Remote attacker attempting API abuse or replaying session tokens.
- Malicious wallet/dApp integration sending malformed addresses (handled via normalization + base58 verification).
- Compromised device or shoulder surfer trying to send funds without biometric approval.
- Backend insider or infrastructure compromise manipulating session policies.
- Network adversary spoofing RPC/backends (mitigated by HTTPS + future mTLS/TLS pinning).

## Assumptions

1. Users install WalletHub mobile client from trusted source and keep OS updated.
2. Wallet private keys remain inside Solana wallets (Seed Vault, Phantom, Backpack, etc.).
3. Device Secure Enclave/TEE enforces biometric factors; LocalAuthentication reports accurate enrollment state.
4. Backend secrets (RPC keys, session signing keys, MPC creds) are stored in managed secret vaults.
5. MPC/multi-sig signer integration will provide threshold security for high-value ops (placeholder today).

## Current Mitigations

- **Biometric gating** before session management, connect, and send actions (Expo Local Authentication).
- **Backend biometric proof validation** to ensure session issuance is tied to device-bound attestation data before issuing new keys.
- **Address normalization / validation** prevents base64/non-base58 injection.
- **Mainnet-only RPC + chain IDs** to avoid devnet spoofing risks.
- **Silent re-authorization watchdog + auditing** proactively refreshes wallet tokens, records wallet capability probes, and captures all signed transactions (incl. method + signature) in backend memory for anomaly review.
- **Session keys gated behind feature flag** (`SESSION_KEYS_ENABLED`) so the legacy signer path can be re-enabled deliberately without code changes.
- **Env centralization** ensures RPC/API endpoints configured consistently; no ad-hoc `.env` parsing.
- **Expo doctor & dependency pinning** keeps native stack aligned for predictable builds.

## Planned Controls

1. **MPC / multi-sig signer abstraction** for backend-issued session keys, with biometric attestation payloads.
2. **Session key registry program** to anchor issuance & revocation on-chain once feature flag is flipped.
3. **Policy engine** (rate limits, amount caps, device trust) enforced before relaying txns.
4. **Audit anomaly detection pipeline** that streams the existing logs into SIEM for automated investigations.
5. **Secure bootstrap scripts/CI** for reproducible build artifacts and supply-chain monitoring.

## Compliance & Privacy Notes

- WalletHub never stores private keys or biometric data; only success/failure events.
- Session tokens scoped to device + policy; revocable on backend and soon on-chain.
- API responses exclude PII beyond wallet labels and device metadata.
- Future milestones: SOC2-style logging, GDPR/CCPA data export & deletion, and MPC provider DPAs.
