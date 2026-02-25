import {
  useWalletBaseStore,
  useWalletBalanceStore,
  useWalletActivityStore,
  useWalletHistoricalStore,
} from "./walletStore";

// Base wallet selectors
export const useLinkedWallets = () =>
  useWalletBaseStore((state) => state.linkedWallets);
export const useActiveWallet = () =>
  useWalletBaseStore((state) => state.activeWallet);
export const useActiveWalletAddress = () =>
  useWalletBaseStore((state) => state.activeWalletAddress);
export const useWalletGroups = () =>
  useWalletBaseStore((state) => state.walletGroups);
export const usePrimaryWalletAddress = () =>
  useWalletBaseStore((state) => state.primaryWalletAddress);

// Balance selectors
export const useBalances = () =>
  useWalletBalanceStore((state) => state.balances);
export const useDetailedBalances = () =>
  useWalletBalanceStore((state) => state.detailedBalances);
export const useTotalBalance = () =>
  useWalletBalanceStore((state) => state.totalBalance);
export const useTotalUsdValue = () =>
  useWalletBalanceStore((state) => state.totalUsdValue);
export const useMissingTokenPrices = () =>
  useWalletBalanceStore((state) => state.missingTokenPrices);

// Activity selectors
export const useWalletActivity = (address: string) =>
  useWalletActivityStore((state) => state.walletActivity[address] || []);

// Historical balance selectors
export const useHistoricalBalances = (network: string, address: string) =>
  useWalletHistoricalStore((state) =>
    state.getHistoricalBalances(network, address),
  );

// Wallet actions selectors
export const useWalletActions = () => {
  const addWallet = useWalletBaseStore((state) => state.addWallet);
  const removeWallet = useWalletBaseStore((state) => state.removeWallet);
  const setActiveWallet = useWalletBaseStore((state) => state.setActiveWallet);
  const setActiveWalletAddress = useWalletBaseStore(
    (state) => state.setActiveWalletAddress,
  );
  const setPrimaryWalletAddress = useWalletBaseStore(
    (state) => state.setPrimaryWalletAddress,
  );
  const createWalletGroup = useWalletBaseStore(
    (state) => state.createWalletGroup,
  );
  const updateWalletGroup = useWalletBaseStore(
    (state) => state.updateWalletGroup,
  );
  const deleteWalletGroup = useWalletBaseStore(
    (state) => state.deleteWalletGroup,
  );
  const addWalletToGroup = useWalletBaseStore(
    (state) => state.addWalletToGroup,
  );
  const removeWalletFromGroup = useWalletBaseStore(
    (state) => state.removeWalletFromGroup,
  );
  const updateBalance = useWalletBalanceStore((state) => state.updateBalance);
  const updateDetailedBalance = useWalletBalanceStore(
    (state) => state.updateDetailedBalance,
  );
  const setMissingTokenPrices = useWalletBalanceStore(
    (state) => state.setMissingTokenPrices,
  );
  const updateTotalBalance = useWalletBalanceStore(
    (state) => state.updateTotalBalance,
  );
  const setWalletActivity = useWalletActivityStore(
    (state) => state.setWalletActivity,
  );
  const clearWalletActivity = useWalletActivityStore(
    (state) => state.clearWalletActivity,
  );
  const updateHistoricalBalance = useWalletHistoricalStore(
    (state) => state.updateHistoricalBalance,
  );

  return {
    addWallet,
    removeWallet,
    setActiveWallet,
    setActiveWalletAddress,
    setPrimaryWalletAddress,
    createWalletGroup,
    updateWalletGroup,
    deleteWalletGroup,
    addWalletToGroup,
    removeWalletFromGroup,
    updateBalance,
    updateDetailedBalance,
    setMissingTokenPrices,
    updateTotalBalance,
    setWalletActivity,
    clearWalletActivity,
    updateHistoricalBalance,
  };
};

// Specific wallet selectors
export const useWalletByAddress = (address: string) => {
  return useWalletBaseStore(
    (state) =>
      state.linkedWallets.find((wallet) => wallet.address === address) || null,
  );
};

export const useWalletBalance = (address: string) => {
  return useWalletBalanceStore((state) => state.balances[address] || 0);
};

export const useWalletDetailedBalance = (address: string) => {
  return useWalletBalanceStore(
    (state) => state.detailedBalances[address] || null,
  );
};

export const useWalletGroupById = (groupId: string) => {
  return useWalletBaseStore(
    (state) => state.walletGroups.find((group) => group.id === groupId) || null,
  );
};
