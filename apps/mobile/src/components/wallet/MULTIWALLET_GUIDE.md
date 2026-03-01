# Multi-Wallet Manager - Complete Implementation Guide

## Overview

This implementation provides a **complete, production-ready solution** for managing multiple independent wallet sessions in React Native Android DApps using the **Solana Mobile Wallet Adapter (MWA) v2** protocol.

### Key Features

✅ **Multiple Independent Sessions**: Connect Phantom + Solflare + Backpack simultaneously  
✅ **Persistent Authorization**: Auto-reconnect using saved auth tokens  
✅ **Zustand State Management**: Optimized, reactive state with AsyncStorage persistence  
✅ **TypeScript First**: Complete type definitions for type safety  
✅ **Biometric Security**: All wallet operations require biometric authentication  
✅ **Error Handling**: Comprehensive error handling with user-friendly messages  
✅ **Pre-built UI Components**: Ready-to-use components with modern design  
✅ **Custom Hook API**: Clean, intuitive API for custom implementations

---

## Installation

### 1. Install Required Dependencies

```bash
pnpm add @solana-mobile/mobile-wallet-adapter-protocol-web3js \
         @solana-mobile/mobile-wallet-adapter-protocol \
         @solana/web3.js
```

### 2. Verify Android Configuration

Ensure your `app.json` has the required permissions:

```json
{
  "expo": {
    "scheme": "wallethub",
    "android": {
      "permissions": [
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    }
  }
}
```

### 3. Android Manifest Setup

Add wallet deep link support to `AndroidManifest.xml`:

```xml
<manifest>
  <queries>
    <!-- Support for MWA wallet detection -->
    <intent>
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:scheme="https" />
    </intent>
  </queries>

  <application>
    <activity
      android:name=".MainActivity"
      android:launchMode="singleTask"
      android:exported="true">

      <!-- Add intent filter for wallet callbacks -->
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="wallethub" />
      </intent-filter>

    </activity>
  </application>
</manifest>
```

---

## Quick Start

### Basic Usage (Pre-built Component)

The easiest way to get started:

```tsx
import { MultiWalletManager } from "./components/wallet";

function App() {
  return (
    <MultiWalletManager
      onWalletSelect={(sessionId) => {
        console.log("Selected wallet:", sessionId);
      }}
    >
      {/* Your app content */}
    </MultiWalletManager>
  );
}
```

### Advanced Usage (Custom Hook)

For full control, use the custom hook:

```tsx
import { useMultiWalletManager } from "./hooks/useMultiWalletManager";

function MyComponent() {
  const {
    sessions,
    activeSession,
    addWallet,
    removeWallet,
    setActiveWallet,
    signTransaction,
    signMessage,
    isLoading,
    error,
  } = useMultiWalletManager();

  const handleAddWallet = async () => {
    try {
      const result = await addWallet({
        label: "Phantom 1",
      });
      console.log("Connected:", result.session);
    } catch (err) {
      console.error("Failed:", err);
    }
  };

  return (
    <View>
      <Button title="Add Wallet" onPress={handleAddWallet} />
      {sessions.map((session) => (
        <Text key={session.sessionId}>{session.label}</Text>
      ))}
    </View>
  );
}
```

---

## API Reference

### `useMultiWalletManager()` Hook

Returns a comprehensive API for wallet management:

#### State

| Property              | Type                    | Description                       |
| --------------------- | ----------------------- | --------------------------------- |
| `sessions`            | `WalletSession[]`       | All connected wallet sessions     |
| `activeSession`       | `WalletSession \| null` | Currently active wallet session   |
| `activeWalletAddress` | `string \| null`        | Active wallet's address           |
| `isLoading`           | `boolean`               | Loading state                     |
| `error`               | `string \| null`        | Current error message             |
| `hasWallets`          | `boolean`               | Whether any wallets are connected |
| `walletCount`         | `number`                | Number of connected wallets       |

#### Actions

##### `addWallet(config?)`

Connect a new wallet with independent session.

```typescript
interface WalletAssociationConfig {
  label?: string; // Custom label (e.g., "Phantom 1")
  baseUri?: string; // Custom wallet association URI
}

const result = await addWallet({
  label: "My Phantom",
});

console.log(result.sessionId); // Unique session ID
console.log(result.session); // Full session object
```

##### `removeWallet(sessionIdOrAddress)`

Remove and deauthorize a wallet session.

```typescript
await removeWallet("session_123456_abc");
// or
await removeWallet("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
```

##### `setActiveWallet(sessionIdOrAddress)`

Switch active wallet session.

```typescript
setActiveWallet("session_123456_abc");
```

##### `signTransaction(transaction, options?)`

Sign a transaction with specified wallet.

```typescript
import { Transaction } from "@solana/web3.js";

const transaction = new Transaction().add(/* ... */);

const signedTx = await signTransaction(transaction, {
  sessionId: "session_123456_abc",
  // or
  walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
});
```

##### `signAllTransactions(transactions, options?)`

Sign multiple transactions.

```typescript
const signedTxs = await signAllTransactions([tx1, tx2, tx3], {
  sessionId: "session_123456_abc",
});
```

##### `signMessage(message, options?)`

Sign a message.

```typescript
const message = new TextEncoder().encode("Hello, World!");
const signature = await signMessage(message);
```

##### `disconnectAll()`

Disconnect all wallets.

```typescript
await disconnectAll();
```

##### `refreshSession(sessionId)`

Refresh authorization for a session.

```typescript
const refreshed = await refreshSession("session_123456_abc");
```

##### `updateWalletLabel(sessionIdOrAddress, label)`

Update wallet label.

```typescript
updateWalletLabel("session_123456_abc", "My Primary Wallet");
```

---

## Architecture

### Session Management

Each call to `addWallet()` creates a **completely independent session**:

```
┌─────────────────────────────────────────────┐
│  WalletHub App                              │
├─────────────────────────────────────────────┤
│  Session 1: Phantom (auth_token_1)          │
│  Session 2: Solflare (auth_token_2)         │
│  Session 3: Backpack (auth_token_3)         │
└─────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌────────┐    ┌──────────┐    ┌─────────┐
    │Phantom │    │ Solflare │    │ Backpack│
    └────────┘    └──────────┘    └─────────┘
```

### Zustand Store Structure

```typescript
{
  sessions: {
    'session_123_abc': {
      sessionId: 'session_123_abc',
      address: '7xKX...',
      label: 'Phantom 1',
      authToken: 'eyJhbG...',
      isActive: true,
      status: 'connected',
      createdAt: 1234567890,
      lastActivityAt: 1234567890,
    },
    // ...
  },
  sessionOrder: ['session_123_abc', ...],
  activeSessionId: 'session_123_abc',
  isLoading: false,
  error: null,
}
```

### Persistence

All sessions are automatically persisted to AsyncStorage:

- Auth tokens are encrypted and stored securely
- Session metadata (labels, addresses) is persisted
- On app restart, sessions are automatically rehydrated
- `isActive` flag is recalculated on rehydration

---

## Security Considerations

### Biometric Authentication

All sensitive operations require biometric approval:

```typescript
// addWallet() requires biometrics
await addWallet();

// signTransaction() requires biometrics
await signTransaction(tx);

// signMessage() requires biometrics
await signMessage(message);
```

### Auth Token Storage

Auth tokens are stored in:

1. **Zustand store** (in-memory, fast access)
2. **AsyncStorage** (persistent, encrypted)
3. **SecureStore** (for highly sensitive data)

### Session Isolation

Each wallet session is completely independent:

- Separate auth tokens
- Separate authorization lifecycle
- No shared state between sessions
- Can be removed/updated independently

---

## Error Handling

### Common Errors

```typescript
try {
  await addWallet();
} catch (err: any) {
  if (err.message.includes("wallet not found")) {
    // No compatible wallet installed
  } else if (err.message.includes("cancelled")) {
    // User cancelled the flow
  } else if (err.message.includes("biometric")) {
    // Biometric auth failed
  } else {
    // Other error
  }
}
```

### Error Recovery

The hook automatically handles:

- Session expiration → prompts re-authorization
- Network errors → retries with backoff
- Wallet app crashes → cleans up stale sessions

---

## Best Practices

### 1. Always Check Active Session

```typescript
if (!activeSession) {
  Alert.alert("Error", "Please select a wallet first");
  return;
}
```

### 2. Handle Loading States

```typescript
<Button
  title={isLoading ? 'Processing...' : 'Sign Transaction'}
  onPress={handleSign}
  disabled={isLoading}
/>
```

### 3. Provide User Feedback

```typescript
try {
  await signTransaction(tx);
  Alert.alert("Success", "Transaction signed!");
} catch (err) {
  Alert.alert("Error", err.message);
}
```

### 4. Clean Up on Unmount

```typescript
useEffect(() => {
  return () => {
    // Optional: disconnect all on app close
    // disconnectAll();
  };
}, []);
```

### 5. Use Labels for Better UX

```typescript
await addWallet({ label: "Phantom - Main" });
updateWalletLabel(sessionId, "Solflare - Trading");
```

---

## Example Use Cases

### Multi-Wallet Portfolio Tracker

```typescript
function PortfolioTracker() {
  const { sessions } = useMultiWalletManager();

  return (
    <View>
      {sessions.map(session => (
        <WalletBalance key={session.sessionId} address={session.address} />
      ))}
    </View>
  );
}
```

### Cross-Wallet Transactions

```typescript
async function transferBetweenWallets(fromSessionId, toAddress, amount) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(
        sessions.find((s) => s.sessionId === fromSessionId).address,
      ),
      toPubkey: new PublicKey(toAddress),
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  );

  const signed = await signTransaction(transaction, {
    sessionId: fromSessionId,
  });

  return connection.sendRawTransaction(signed);
}
```

### Wallet-Specific Actions

```typescript
function WalletActions({ sessionId }) {
  const { signMessage } = useMultiWalletManager();

  const handleSignIn = async () => {
    const message = new TextEncoder().encode(
      `Sign in with Solana\nWallet: ${sessionId}`
    );
    const signature = await signMessage(message, { sessionId });
    // Verify signature on backend...
  };

  return <Button title="Sign In" onPress={handleSignIn} />;
}
```

---

## Troubleshooting

### Issue: Wallet doesn't appear in chooser

**Solution**: Ensure at least one MWA-compatible wallet is installed (Phantom, Solflare, Backpack).

### Issue: Authorization fails silently

**Solution**: Check logs for detailed error messages. Enable debug logging:

```typescript
console.log("MWA Debug:", {
  sessions: sessions.length,
  activeSession: activeSession?.sessionId,
  error: error,
});
```

### Issue: Sessions not persisting

**Solution**: Verify AsyncStorage is working:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const keys = await AsyncStorage.getAllKeys();
console.log("Stored keys:", keys);
```

### Issue: Biometric prompts not showing

**Solution**: Ensure device has biometric capability and permissions are granted.

---

## Testing

### Unit Tests

```typescript
describe("useMultiWalletManager", () => {
  it("should add a new wallet session", async () => {
    const { result } = renderHook(() => useMultiWalletManager());

    await act(async () => {
      await result.current.addWallet({ label: "Test Wallet" });
    });

    expect(result.current.sessions.length).toBe(1);
    expect(result.current.sessions[0].label).toBe("Test Wallet");
  });
});
```

### Integration Tests

```typescript
describe("Multi-Wallet Integration", () => {
  it("should support multiple simultaneous wallets", async () => {
    // Connect Phantom
    await addWallet({ label: "Phantom" });

    // Connect Solflare
    await addWallet({ label: "Solflare" });

    // Both should be present
    expect(sessions.length).toBe(2);
  });
});
```

---

## Performance Optimization

### Selectors for Optimized Rendering

```typescript
import { useMultiWalletSelectors } from './store/multiWalletStore';

function MyComponent() {
  const { sessions, activeSession, walletCount } = useMultiWalletSelectors();

  // Only re-renders when these specific values change
  return <Text>{walletCount} wallets connected</Text>;
}
```

### Memoization

The hook return value is automatically memoized to prevent unnecessary re-renders.

---

## Future Enhancements

Potential improvements:

- [ ] Hardware wallet support
- [ ] Multi-chain support (Ethereum, Polygon, etc.)
- [ ] Wallet grouping and organization
- [ ] Advanced transaction batching
- [ ] Session timeout configuration
- [ ] Custom wallet chooser UI

---

## Support & Resources

- **Official MWA Docs**: https://docs.solanamobile.com
- **MWA Specification**: https://solana-mobile.github.io/mobile-wallet-adapter/spec/
- **GitHub Examples**: https://github.com/solana-mobile/mobile-wallet-adapter
- **Solana Discord**: https://discord.com/invite/solana

---

## License

MIT License - Feel free to use in your projects!
