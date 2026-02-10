# External Explore Integration

WalletHub now delegates its Explore tab to a hosted Solana dApp directory so we can surface the freshest partner experiences without shipping new binaries.

## Configuration

| Env var | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_EXPLORE_URL` | Base URL that the in-app WebView loads. | `https://explore.solanamobile.com/?ref=wallethub` |
| `EXPO_PUBLIC_EXPLORE_ALLOWLIST` | Comma-separated list of hostnames permitted inside the WebView (subdomains are allowed automatically). | Host derived from `EXPO_PUBLIC_EXPLORE_URL` |
| `EXPO_PUBLIC_TELEMETRY_URL` | Optional endpoint that receives telemetry POSTs at `/telemetry/explore`. If unset, events stay client-side. | _unset_ |

Update these values inside your `.env` / Expo config before running `expo start`.

## Runtime Behavior

1. The Explore tab renders a secure `react-native-webview` pointed at `EXPO_PUBLIC_EXPLORE_URL`.
2. Every navigation request is checked against the allowlist. If a URL fails validation, WalletHub blocks the in-app navigation and opens the link via the system browser instead.
3. Users see inline messaging that Explore is powered by an external provider plus a rendered list of trusted hosts for transparency.
4. Loading, error, reload, and blocked-navigation events funnel through `telemetryService.recordExploreEvent`. When `EXPO_PUBLIC_TELEMETRY_URL` is defined, those events are POSTed to your backend for observability; otherwise they no-op.
5. Hero controls let testers reload the embedded experience or pop it out to the system browser for deep debugging.

## Updating the Provider

1. Pick the new provider URL and confirm it supports dark mode or theming.
2. Add every host it may redirect to into `EXPO_PUBLIC_EXPLORE_ALLOWLIST`.
3. Reload the app (`expo start -c`) so Metro picks up new inline env values.
4. (Optional) Point `EXPO_PUBLIC_TELEMETRY_URL` at your API to capture Explore engagement metrics.

Because navigation is tightly allow-listed, misconfiguration will simply show a browser fallback instead of loading untrusted content inside WalletHub.
