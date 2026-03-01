# WalletHub Demo Script

## MONOLITH Solana Mobile Hackathon

### Demo Overview

**Duration**: 5-7 minutes
**Goal**: Showcase WalletHub's mobile-first wallet aggregation with MWA integration

---

## Setup (Before Demo)

### Required

- [ ] Android device with Phantom/Solflare wallet installed
- [ ] Backend API running and accessible
- [ ] Demo wallet with ~0.1 SOL + some tokens
- [ ] WalletHub APK installed on device
- [ ] Screen recording software ready

### Environment

- Backend: Running on Railway/Render at `https://api.wallethub.app`
- Mobile: Preview build installed via EAS
- Network: Solana Mainnet (via Helius)

---

## Demo Flow

### 1. Introduction (30 seconds)

**Script**:

> "WalletHub is a mobile-native Solana wallet hub that aggregates multiple wallets through Mobile Wallet Adapter, providing unified portfolio tracking, activity visualization, and secure transactions—all with biometric authentication."

**Show**: App icon and splash screen

---

### 2. Wallet Connection (1 minute)

**Action**:

1. Open WalletHub
2. Tap "Connect Wallet" button
3. Show MWA chooser appearing automatically
4. Select Phantom/Solflare
5. Approve connection in wallet app
6. Return to WalletHub

**Highlight**:

- "No manual wallet discovery needed"
- "MWA system chooser handles everything"
- "Wallet apps decide which accounts to share"

**Expected Result**:

- Wallet connected
- Balance displayed immediately
- Address shown with copy functionality

---

### 3. Portfolio Visualization (1.5 minutes)

**Action**:

1. Pull down to refresh balance
2. Scroll to balance chart
3. Point out 24h history
4. Scroll to token pie chart
5. Show token distribution

**Highlight**:

- "Real-time balance tracking via Helius RPC"
- "Historical data shows portfolio changes"
- "Token allocation breakdown from Jupiter"
- "All data aggregated client-side for privacy"

**Expected Result**:

- Charts render smoothly
- Data updates on refresh
- Token names and values displayed

---

### 4. Activity Tracking (1.5 minutes)

**Action**:

1. Scroll to Recent Activity section
2. Tap an activity item
3. Show transaction detail modal
4. Point out:
   - Transaction type and direction
   - Amount with color coding
   - Network fee
   - Timestamp
   - Source address
   - Signature
5. Tap "View on Solscan"
6. Show explorer page
7. Return to app

**Highlight**:

- "Activity merged from Jupiter + Helius"
- "Rich transaction details in-app"
- "One-tap explorer verification"
- "Copy signature/address for sharing"

**Expected Result**:

- Activity list populated
- Detail modal shows complete info
- External links work

---

### 5. Send Transaction (2 minutes)

**Action**:

1. Tap "Send" button
2. Show biometric prompt
3. Authenticate (Face ID/Fingerprint)
4. Enter recipient address (prepare demo address)
5. Enter amount (0.001 SOL)
6. Point out:
   - Available balance display
   - Fee estimation (~0.000005 SOL)
   - "Use max" button reserves fee
7. Tap "Send"
8. Show MWA approval screen
9. Approve in wallet
10. Show success toast
11. Point out:
    - Balance updated
    - Activity list refreshed
    - New transaction appears

**Highlight**:

- "Biometric security before sensitive ops"
- "Real-time fee estimation"
- "Smart max amount calculation"
- "Instant UI updates post-confirmation"

**Expected Result**:

- Transaction sent successfully
- Balance decremented
- New transaction in activity feed

---

### 6. Receive Flow (45 seconds)

**Action**:

1. Tap "Receive" button
2. Show QR code
3. Point out address
4. Tap "Copy" button
5. Show success toast
6. Tap "Share" button
7. Show share sheet

**Highlight**:

- "No biometric needed for receive"
- "QR for easy in-person transfers"
- "Copy/share for remote transfers"

**Expected Result**:

- QR code displays
- Copy works
- Share sheet appears

---

### 7. Multiple Wallet Management (1 minute)

**Action**:

1. Open account selector
2. Show connected wallet
3. Point out:
   - Wallet name
   - Shortened address
   - Balance
4. Tap to cycle through (if multiple connected)
5. Show primary wallet indicator
6. Tap "Set Primary" on different wallet
7. Show biometric prompt
8. Authenticate
9. Show success

**Highlight**:

- "Multi-wallet support via MWA"
- "Primary wallet for default sends"
- "Biometric guard on primary changes"
- "Per-wallet activity tracking"

**Expected Result**:

- Can switch between wallets
- Primary wallet marked
- Changes require auth

---

### 8. Architecture Highlights (30 seconds)

**Show** (slide/diagram if available):

- Mobile Wallet Adapter integration
- Client-side data aggregation
- Backend session management
- Biometric security layer

**Script**:

> "Under the hood, WalletHub leverages MWA for native wallet auth, aggregates data from Jupiter and Helius for rich portfolio insights, implements biometric gating for security, and maintains a minimal backend for session coordination and push notifications."

---

## Key Talking Points

### Technical Excellence

- ✅ Pure MWA integration (no custom wallet detection)
- ✅ System chooser for wallet selection
- ✅ Biometric security for sensitive operations
- ✅ Client-side data aggregation (privacy-first)
- ✅ Real-time balance tracking
- ✅ Rich transaction visualization
- ✅ TypeScript monorepo with shared contracts

### User Experience

- ✅ Zero-friction wallet connection
- ✅ Intuitive portfolio visualization
- ✅ Detailed transaction history
- ✅ Smooth send/receive flows
- ✅ One-tap explorer verification
- ✅ Haptic feedback throughout

### Mobile-First Design

- ✅ Native Android (React Native + Expo)
- ✅ Dark theme optimized for OLED
- ✅ Gesture-friendly navigation
- ✅ Optimized for Saga devices
- ✅ Edge-to-edge UI

---

## Fallback Scenarios

### If Wallet Connection Fails

**Fallback**: Show already-connected state from previous session
**Script**: "In case of connection issues, the app caches authorized sessions securely. Let me show the portfolio view with a pre-connected wallet."

### If Transaction Fails

**Fallback**: Show transaction history with past successful txns
**Script**: "Transaction submission requires network confirmation. Let me show previous successful transactions and their details instead."

### If Data Loading Slow

**Fallback**: Show skeleton loaders and explain caching
**Script**: "We show loading states while fetching from Jupiter and Helius APIs. The app caches data locally for instant subsequent loads."

---

## Post-Demo Q&A Prep

### Expected Questions

**Q: Why not use Wallet Connect?**
A: Mobile Wallet Adapter is purpose-built for Solana mobile, providing deeper OS integration, better security, and native wallet chooser. WC requires browser context.

**Q: How do you handle multiple wallets?**
A: MWA's authorization result includes all accounts the wallet chooses to share. We persist them locally and let users designate a primary wallet for sends.

**Q: What about security?**
A: Three layers: (1) MWA's secure communication channel, (2) Local biometric auth for sensitive ops, (3) Backend session validation with nonce verification.

**Q: Can I use it with hardware wallets?**
A: If your mobile wallet app (like Solflare) supports hardware wallet integration, yes—MWA is agnostic to the wallet's internal key management.

**Q: What's next?**
A: Multi-sig support, NFT gallery, DeFi protocol integration, token swaps via Jupiter Swap API, and eventually iOS support.

---

## Recording Checklist

- [ ] Clean device home screen
- [ ] Disable notifications
- [ ] Set brightness to max
- [ ] Close all background apps
- [ ] Pre-load demo wallet with funds
- [ ] Test run the flow once
- [ ] Clear any test transactions
- [ ] Charge device to 100%
- [ ] Enable airplane mode (if using local backend)
- [ ] Start screen recording software
- [ ] Use stable lighting
- [ ] Avoid hand shake (tripod if available)

---

## Submission Materials

### Required

1. **Video Demo** (3-5 min)
   - Screen recording + voiceover
   - Show key features
   - Highlight MWA integration

2. **GitHub Repository**
   - Public repo link
   - Clear README
   - Setup instructions
   - License (MIT)

3. **Live APK** (optional but recommended)
   - EAS preview build
   - Download link
   - Installation guide

4. **Screenshots**
   - Wallet connection
   - Portfolio view
   - Transaction details
   - Send modal
   - Receive QR

### Optional Bonus

- Architecture diagram
- API documentation
- Deployment guide
- Test coverage report
- Performance metrics

---

## Success Metrics

### Demo Success Indicators

[x] Wallet connects on first try
[x] Charts render smoothly
[x] Transaction completes successfully
[x] No crashes or freezes
[x] Stays within 7-minute window

### Judge Appeal Points

- Clean, modern UI
- Smooth animations
- Responsive interactions
- Clear value proposition
- Technical depth
- Production-ready feel

---

## Contact Info for Follow-up

- GitHub: [Your GitHub]
- Email: [Your Email]
- Twitter: [Your Twitter]
- Live Demo: [EAS Link or TestFlight]
