import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import type { LinkedWallet } from "../../types/wallet";
import { decodeWalletAddress } from "../../utils";

export const normalizeAuthorization = (
  authorization: AuthorizationResult,
): LinkedWallet[] =>
  authorization.accounts.map(
    (accountFromWallet: { address: string; label?: string }) => ({
      address: decodeWalletAddress(accountFromWallet.address),
      label: accountFromWallet.label,
      authToken: authorization.auth_token,
      walletName: accountFromWallet.label,
      icon: (authorization as any).wallet_icon,
    }),
  );