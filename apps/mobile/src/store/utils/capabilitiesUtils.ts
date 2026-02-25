import type { WalletCapabilityReport } from "@wallethub/contracts";
import type { Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const DEFAULT_CAPABILITIES: WalletCapabilityReport = {
  supportsCloneAuthorization: false,
  supportsSignAndSendTransactions: true,
  supportsSignTransactions: true,
  supportsSignMessages: false,
  maxTransactionsPerRequest: 10,
  maxMessagesPerRequest: 10,
  supportedTransactionVersions: [],
  featureFlags: [],
};

type WalletCapabilitiesResponse = Awaited<
  ReturnType<Web3MobileWallet["getCapabilities"]>
> | null;

export const mapCapabilities = (
  capabilities: WalletCapabilitiesResponse,
): WalletCapabilityReport => {
  if (!capabilities) {
    return { ...DEFAULT_CAPABILITIES };
  }

  const featureFlags = Array.isArray(capabilities.features)
    ? capabilities.features.map(String)
    : [];

  return {
    supportsCloneAuthorization:
      capabilities.supports_clone_authorization ||
      featureFlags.includes("solana:cloneAuthorization"),
    supportsSignAndSendTransactions:
      capabilities.supports_sign_and_send_transactions ||
      featureFlags.includes("solana:signAndSendTransactions"),
    supportsSignTransactions:
      featureFlags.includes("solana:signTransactions") ||
      DEFAULT_CAPABILITIES.supportsSignTransactions,
    supportsSignMessages: featureFlags.includes("solana:signMessages"),
    maxTransactionsPerRequest: capabilities.max_transactions_per_request,
    maxMessagesPerRequest: capabilities.max_messages_per_request,
    supportedTransactionVersions: capabilities.supported_transaction_versions
      ? capabilities.supported_transaction_versions.map(String)
      : DEFAULT_CAPABILITIES.supportedTransactionVersions,
    featureFlags,
  };
};

export { DEFAULT_CAPABILITIES };
