# WalletHub - Hackathon Submission

## 🏆 MONOLITH Solana Mobile Hackathon

**Submission Date**: March 2026  
**Track**: Mobile Wallet / DeFi  
**Team**: [Your Name/Team Name]

---

## 📋 Submission Checklist

### Required Materials
- [x] **GitHub Repository**: Public and accessible
- [ ] **Demo Video**: 3-5 minute walkthrough
- [ ] **Live Demo**: Working APK or deployed app
- [ ] **Documentation**: Complete README and guides
- [ ] **Screenshots**: Key features showcased

### Technical Requirements
- [x] Mobile Wallet Adapter (MWA) integration
- [x] Working wallet connection flow
- [x] Balance tracking and visualization
- [x] Transaction history
- [x] Send/receive functionality
- [x] Biometric authentication
- [x] Security best practices

---

## 🎯 Project Overview

### Problem Statement
Managing multiple Solana wallets on mobile is fragmented and inconvenient. Users need to:
- Switch between different wallet apps
- Manually track portfolio across wallets
- Deal with complex wallet discovery
- Lack unified transaction history

### Solution: WalletHub
WalletHub aggregates multiple Solana wallets through **Mobile Wallet Adapter (MWA)**, providing:
- **Unified Portfolio View**: Track all wallets in one place
- **MWA Integration**: Native wallet chooser, no manual discovery
- **Biometric Security**: Face ID/Fingerprint for sensitive operations
- **Rich Visualization**: Charts, graphs, and detailed transaction history
- **Privacy-First**: Client-side data aggregation

---

## 🚀 Key Features

### 1. Mobile Wallet Adapter Integration
- ✅ System-level wallet chooser
- ✅ No custom wallet detection needed
- ✅ Secure deep-linking to wallet apps
- ✅ Multi-account support (wallet-dependent)

### 2. Portfolio Management
- ✅ Real-time balance tracking via Helius RPC
- ✅ Historical balance charts (24h)
- ✅ Token allocation pie charts via Jupiter API
- ✅ Multi-wallet portfolio aggregation

### 3. Transaction Features
- ✅ Send SOL and SPL tokens
- ✅ Biometric authentication before sending
- ✅ Real-time fee estimation
- ✅ Transaction history from Jupiter + Helius
- ✅ Detailed transaction view with Solscan links

### 4. Security
- ✅ Biometric gating for sensitive operations
- ✅ Backend biometric proof validation
- ✅ Secure session management
- ✅ Address validation and normalization
- ✅ Mainnet-only RPC (no devnet spoofing)
- ✅ Threat model documented

### 5. User Experience
- ✅ Dark theme optimized for OLED
- ✅ Smooth animations and haptic feedback
- ✅ Gesture-friendly navigation
- ✅ Skeleton loaders for loading states
- ✅ Error handling and recovery

---

## 🛠️ Technical Architecture

### Tech Stack
- **Frontend**: React Native + Expo (SDK 54)
- **Backend**: NestJS + TypeScript
- **State Management**: Zustand (split stores)
- **Blockchain**: @solana/web3.js
- **UI Components**: React Native Paper, Lucide Icons
- **Security**: Expo Local Authentication, Secure Store
- **Data Sources**: Helius RPC, Jupiter API

### Architecture Highlights

```
┌─────────────────┐         ┌─────────────────┐
│   Mobile App    │◄───────►│   Backend API   │
│   (Expo RN)     │  HTTPS  │   (NestJS)      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Wallet Apps    │         │  Solana RPC     │
│  (MWA)          │         │  (Helius)       │
└─────────────────┘         └─────────────────┘
         │                           │
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  User Keys      │         │  Jupiter API    │
│  (Secure)       │         │  (Portfolio)    │
└─────────────────┘         └─────────────────┘
```

### Key Design Decisions

1. **MWA-First Approach**: Leverages Solana Mobile Stack's MWA for native integration
2. **Client-Side Aggregation**: Privacy-first, data aggregated on device
3. **Minimal Backend**: Only session coordination and policy enforcement
4. **Biometric Security**: All sensitive operations require biometric approval
5. **TypeScript Monorepo**: Shared contracts between frontend and backend

---

## 📊 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health probe |
| GET | `/wallets` | Aggregated wallet data |
| POST | `/wallets/link` | Link wallet metadata |
| GET | `/session` | List session keys |
| GET | `/session/policies` | List policies |
| POST | `/session/issue` | Issue session key (biometric) |
| PATCH | `/session/:id/revoke` | Revoke session |
| DELETE | `/session/:id` | Revoke via delete |

---

## 🎬 Demo Instructions

### For Judges

1. **Install the App**
   - Download APK from [link]
   - Install on Android device
   - Grant necessary permissions

2. **Connect Wallet**
   - Open WalletHub
   - Tap "Connect Wallet"
   - Select your preferred wallet (Phantom, Solflare, etc.)
   - Approve connection in wallet app

3. **Explore Features**
   - View portfolio balance and charts
   - Scroll through transaction history
   - Tap a transaction to see details
   - Try the "Send" flow (biometric required)
   - Use "Receive" to see QR code

4. **Test Multi-Wallet** (optional)
   - Connect multiple wallets
   - Switch between them
   - Set primary wallet

### Demo Video Outline

**Duration**: 5 minutes

1. **Introduction** (30s)
   - Project name and goal
   - Key value proposition

2. **Wallet Connection** (1 min)
   - Show MWA chooser
   - Approve connection
   - Highlight ease of use

3. **Portfolio View** (1 min)
   - Balance display
   - Charts and token allocation
   - Real-time updates

4. **Transaction History** (1 min)
   - Recent activity list
   - Transaction details
   - Solscan integration

5. **Send Flow** (1.5 min)
   - Biometric authentication
   - Enter recipient and amount
   - Fee estimation
   - MWA approval
   - Success confirmation

6. **Conclusion** (30s)
   - Technical highlights
   - Future roadmap

---

## 🔒 Security Considerations

### Threat Model
See [`docs/threat-model.md`](./docs/threat-model.md) for complete threat model.

### Key Security Features
- **Never stores private keys**: Keys remain in trusted wallet apps
- **Biometric gating**: All sensitive operations require biometric approval
- **Backend validation**: Biometric proofs validated server-side
- **Address validation**: Prevents injection attacks
- **Mainnet-only**: No devnet spoofing risks
- **Session management**: Scoped, revocable session keys

### Assumptions
- Users install app from trusted source
- Device TEE/Secure Enclave is secure
- Wallet apps (Phantom, Solflare, etc.) are trusted
- RPC providers (Helius) are trusted

---

## 📈 Future Roadmap

### Post-Hackathon Plans
1. **Multi-sig Support**: Integrate MPC provider for backend session keys
2. **NFT Gallery**: Display and manage NFTs
3. **Token Swaps**: Jupiter Swap API integration
4. **DeFi Integration**: Track staking, lending positions
5. **iOS Support**: Expand to iOS platform
6. **Push Notifications**: Transaction alerts and price warnings
7. **Advanced Analytics**: Portfolio performance tracking

---

## 👥 Team

- **Developer**: [Your Name]
- **GitHub**: [@your-github](https://github.com/your-github)
- **Twitter**: [@your-twitter](https://twitter.com/your-twitter)
- **Email**: your.email@example.com

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- **Solana Foundation**: For building Solana Mobile Stack
- **Helius**: For RPC infrastructure and APIs
- **Jupiter**: For aggregator APIs and portfolio data
- **MONOLITH**: For organizing this hackathon

---

## 📞 Support

For questions or issues:
- Open a GitHub issue
- Contact via email
- DM on Twitter

**Happy Building! 🚀**
