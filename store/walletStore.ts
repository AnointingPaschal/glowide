import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  balances: {
    usdc: string;
    eurc: string;
    cirBTC: string;
    native: string;
  };

  // Setters
  setAddress: (address: string | null) => void;
  setChainId: (chainId: number | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setBalances: (balances: Partial<WalletState["balances"]>) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      balances: { usdc: "0", eurc: "0", cirBTC: "0", native: "0" },

      setAddress: (address) => set({ address }),
      setChainId: (chainId) => set({ chainId }),
      setConnected: (isConnected) => set({ isConnected }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setBalances: (balances) =>
        set((state) => ({ balances: { ...state.balances, ...balances } })),
      disconnect: () =>
        set({
          address: null,
          chainId: null,
          isConnected: false,
          isConnecting: false,
          balances: { usdc: "0", eurc: "0", cirBTC: "0", native: "0" },
        }),
    }),
    {
      name: "glowide-wallet",
      // Only persist address and chainId — connection state is re-established
      // on mount via eth_accounts (silently, without prompting the user).
      partialize: (state) => ({
        address: state.address,
        chainId: state.chainId,
      }),
    }
  )
);
