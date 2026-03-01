/**
 * Multi-Wallet Manager Module
 *
 * Complete solution for managing multiple independent wallet sessions
 * in React Native Android DApps using Solana Mobile Wallet Adapter v2.
 *
 * @module MultiWalletManager
 *
 * @example
 * ```typescript
 * // Basic usage
 * import { useMultiWalletManager, MultiWalletManager } from '@wallethub/mobile';
 *
 * function App() {
 *   const {
 *     sessions,
 *     activeSession,
 *     addWallet,
 *     removeWallet,
 *     setActiveWallet,
 *     signTransaction,
 *   } = useMultiWalletManager();
 *
 *   return (
 *     <View>
 *       <Button title="Add Wallet" onPress={() => addWallet({ label: 'Phantom 1' })} />
 *       {sessions.map(session => (
 *         <Text key={session.sessionId}>{session.label}</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using the pre-built UI component
 * import { MultiWalletManager } from '@wallethub/mobile';
 *
 * function App() {
 *   return (
 *     <MultiWalletManager
 *       onWalletSelect={(sessionId) => {
 *         console.log('Selected wallet:', sessionId);
 *       }}
 *     >
 *       {/* Your app content *}/}
 *     </MultiWalletManager>
 *   );
 * }
 * ```
 */

// Types
export type {
  WalletSession,
  MultiWalletState,
  MultiWalletActions,
  AddWalletResult,
  WalletAssociationConfig,
  SignTransactionOptions,
  UseMultiWalletManagerReturn,
} from "../../types/multiWallet";

// Hooks
export { useMultiWalletManager } from "../../hooks/useMultiWalletManager";

// Store
export {
  useMultiWalletStore,
  useMultiWalletSelectors,
} from "../../store/multiWalletStore";

// Components
export { MultiWalletManager } from "./MultiWalletManager";
export { MultiWalletExample } from "./MultiWalletExample";
