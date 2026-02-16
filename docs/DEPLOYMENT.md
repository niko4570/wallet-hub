# WalletHub Deployment Guide

## Mobile App Deployment (Expo EAS)

### Prerequisites

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Configure your project:
   ```bash
   cd apps/mobile
   eas init
   ```

### Environment Variables

Before building, ensure you have set up the required environment variables:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys:
   - `EXPO_PUBLIC_HELIUS_API_KEY`: Get from [Helius](https://helius.xyz/)
   - `EXPO_PUBLIC_JUPITER_API_KEY`: Get from [Jupiter](https://dev.jup.ag/)
   - `EXPO_PUBLIC_API_URL`: Your backend API URL

### Building

#### Development Build
For testing on physical devices:
```bash
eas build --profile development --platform android
```

#### Preview Build (APK)
For internal testing:
```bash
eas build --profile preview --platform android
```

#### Production Build (AAB)
For Google Play Store:
```bash
eas build --profile production --platform android
```

### Android-specific Setup

1. **Generate Keystore** (first time only):
   ```bash
   eas credentials
   ```
   Choose "Android" → "Production" → "Generate new keystore"

2. **Configure Google Play Service Account** (for automated submission):
   - Go to Google Play Console → Setup → API access
   - Create a service account
   - Download the JSON key
   - Save as `service-account-key.json` in `apps/mobile/`

### Submitting to Google Play

```bash
eas submit --platform android --latest
```

## Backend Deployment

### Docker Deployment

1. **Build the image**:
   ```bash
   cd /path/to/wallethub
   docker build -t wallethub-api -f apps/api/Dockerfile .
   ```

2. **Run with environment variables**:
   ```bash
   docker run -d -p 3000:3000 \
     -e DATABASE_URL=postgresql://user:pass@host:5432/wallethub \
     -e SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
     -e HELIUS_API_KEY=YOUR_KEY \
     -e JUPITER_API_KEY=YOUR_KEY \
     --name wallethub-api \
     wallethub-api
   ```

### Managed Hosting Options

#### Railway / Render

1. Connect your GitHub repository
2. Set environment variables:
   - `DATABASE_URL`
   - `HELIUS_API_KEY`
   - `JUPITER_API_KEY`
   - `PORT` (optional, defaults to 3000)
3. Deploy from `apps/api` directory
4. Use the Dockerfile for deployment

#### Fly.io

1. Install flyctl and login
2. Create `fly.toml` in `apps/api/`:
   ```toml
   app = "wallethub-api"
   
   [build]
     dockerfile = "Dockerfile"
   
   [env]
     PORT = "3000"
   
   [[services]]
     internal_port = 3000
     protocol = "tcp"
   
     [[services.ports]]
       port = 80
       handlers = ["http"]
   
     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```

3. Deploy:
   ```bash
   cd apps/api
   flyctl launch
   flyctl secrets set DATABASE_URL=... HELIUS_API_KEY=... JUPITER_API_KEY=...
   flyctl deploy
   ```

### Database Setup

Use managed PostgreSQL from:
- **Neon**: Free tier with 0.5GB storage
- **Supabase**: Free tier with 500MB storage
- **Railway**: Integrated with deployment

Run migrations after deployment:
```bash
# If using Prisma
npx prisma migrate deploy

# If using TypeORM
npm run migration:run
```

## Environment Variables Reference

### Backend (`apps/api`)
- `PORT`: Server port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `SOLANA_RPC_URL`: Solana RPC endpoint
- `HELIUS_API_KEY`: Helius API key
- `JUPITER_API_KEY`: Jupiter API key
- `SOLANA_PRIORITY_RPC_URL`: Optional priority RPC

### Mobile (`apps/mobile`)
- `EXPO_PUBLIC_API_URL`: Backend API URL
- `EXPO_PUBLIC_HELIUS_API_KEY`: Helius API key
- `EXPO_PUBLIC_JUPITER_API_KEY`: Jupiter API key
- `EXPO_PUBLIC_RPC_URL`: Optional RPC override

## Hackathon Demo Deployment

### Quick Deploy for Demo

1. **Backend** (Railway):
   - Deploy to Railway using GitHub integration
   - Set env vars via Railway dashboard
   - Note the public URL (e.g., `https://wallethub-api.up.railway.app`)

2. **Mobile** (EAS):
   ```bash
   cd apps/mobile
   # Set backend URL in eas.json preview profile
   # Update EXPO_PUBLIC_API_URL to Railway URL
   eas build --profile preview --platform android
   # Download APK and install on device
   ```

3. **Testing**:
   - Install APK on Android device
   - Connect wallet via MWA
   - Verify portfolio sync
   - Test send/receive
   - Check transaction details

## Troubleshooting

### Build Errors

**"Could not find module"**: Clear Metro cache
```bash
cd apps/mobile
rm -rf .expo node_modules
npm install
npx expo start -c
```

**EAS build fails**: Check build logs
```bash
eas build:list
eas build:view [BUILD_ID]
```

### Runtime Errors

**"Network request failed"**: Check API URL and CORS
- Ensure `EXPO_PUBLIC_API_URL` is correct
- Verify backend is running and accessible
- Check backend CORS configuration

**"Authentication failed"**: Check API keys
- Verify Helius and Jupiter keys are valid
- Check key quotas and limits

## Production Checklist

- [ ] Environment variables configured
- [ ] API keys added to secrets (not committed)
- [ ] Database migrations run
- [ ] Backend health check accessible
- [ ] Mobile app connects to production API
- [ ] Biometric authentication working
- [ ] Wallet connection tested
- [ ] Send/receive flows tested
- [ ] Transaction history loads
- [ ] Push notifications configured
- [ ] Error tracking enabled (Sentry)
- [ ] Analytics configured (if needed)
