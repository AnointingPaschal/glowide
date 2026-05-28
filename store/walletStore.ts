import { create } from "zustand";

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
  
  setAddress: (address: string | null) => void;
  setChainId: (chainId: number | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setBalances: (balances: Partial<WalletState["balances"]>) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
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
      balances: { usdc: "0", eurc: "0", cirBTC: "0", native: "0" },
    }),
}));
