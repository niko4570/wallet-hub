import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthorizationPreview, LinkedWallet } from "../../../types/wallet";
import { useSolanaStore } from "../../solanaStore";
import { useWalletBaseStore } from "../../walletStore";
import { walletService } from "../../../services";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../../services", () => ({
  authorizationApi: {},
  walletService: {
    finalizeWalletAuthorization: jest.fn(),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockWalletService = walletService as unknown as {
  finalizeWalletAuthorization: jest.Mock;
};

const resetWalletBaseStore = () => {
  useWalletBaseStore.setState({
    linkedWallets: [],
    activeWallet: null,
    activeWalletAddress: null,
    primaryWalletAddress: null,
    walletGroups: [],
  });
};

const resetSolanaStore = (refreshBalanceMock: jest.Mock) => {
  useSolanaStore.setState({
    linkedWallets: [],
    activeWallet: null,
    activeWalletAddress: null,
    isAuthenticated: false,
    balances: {},
    detailedBalances: {},
    isLoading: false,
    error: null,
    refreshBalance: refreshBalanceMock,
  });
};

describe("walletActions finalizeAuthorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWalletBaseStore();
  });

  it("syncs linked wallets into wallet base store", async () => {
    const refreshBalanceMock = jest.fn().mockResolvedValue(0);
    resetSolanaStore(refreshBalanceMock);
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const accounts: LinkedWallet[] = [
      {
        address: "Hp7b8rDM3nxxBUjaN49JWZaw1rgPrrWEZeMpi2TShN8b",
        authToken: "test-token",
        label: "phantom-wallet",
        walletName: "phantom-wallet",
      },
    ];
    mockWalletService.finalizeWalletAuthorization.mockResolvedValue(accounts);

    const preview: AuthorizationPreview = { accounts: [] };
    await useSolanaStore.getState().finalizeAuthorization(preview);

    expect(refreshBalanceMock).toHaveBeenCalledWith(accounts[0].address);

    const walletState = useWalletBaseStore.getState();
    expect(walletState.linkedWallets).toHaveLength(1);
    expect(walletState.linkedWallets[0].address).toBe(accounts[0].address);
    expect(walletState.activeWallet?.address).toBe(accounts[0].address);
  });
});
