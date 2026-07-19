import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveWalletKey =
  | { type: "local";     id: string }
  | { type: "circle";    id: string }
  | { type: "metamask";  id?: undefined }
  | null;

interface ActiveWalletState {
  active: ActiveWalletKey;
  setActiveWalletKey: (key: ActiveWalletKey) => void;
}

/**
 * Single source of truth for "which wallet is currently active" across
 * local (self-custody), Circle (developer), and MetaMask connections.
 * Prevents the bug where multiple wallet stores each think they're active
 * simultaneously, causing multiple checkmarks / wrong displayed address.
 */
export const useActiveWalletStore = create<ActiveWalletState>()(
  persist(
    (set) => ({
      active: null,
      setActiveWalletKey: (key) => set({ active: key }),
    }),
    { name: "glowide-active-wallet" }
  )
);
