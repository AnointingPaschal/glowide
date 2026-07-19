import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local wallet store — real client-generated wallets (ethers.js).
 * Private keys are encrypted with a user password (ethers keystore v3 JSON)
 * and stored in localStorage via zustand persist. Never sent to any server.
 */
export interface LocalWallet {
  id: string;            // uuid
  name: string;          // "Wallet 1", user-editable
  address: string;
  encryptedJson: string;  // ethers.js encrypted keystore (JSON string)
  createdAt: number;
}

interface LocalWalletState {
  wallets: LocalWallet[];
  activeWalletId: string | null;

  addWallet: (w: LocalWallet) => void;
  removeWallet: (id: string) => void;
  setActive: (id: string) => void;
  renameWallet: (id: string, name: string) => void;
}

export const useLocalWalletStore = create<LocalWalletState>()(
  persist(
    (set) => ({
      wallets: [],
      activeWalletId: null,

      addWallet: (w) =>
        set((s) => ({
          wallets: [...s.wallets, w],
          activeWalletId: w.id,
        })),

      removeWallet: (id) =>
        set((s) => {
          const wallets = s.wallets.filter((w) => w.id !== id);
          return {
            wallets,
            activeWalletId:
              s.activeWalletId === id ? (wallets[0]?.id ?? null) : s.activeWalletId,
          };
        }),

      setActive: (id) => set({ activeWalletId: id }),

      renameWallet: (id, name) =>
        set((s) => ({
          wallets: s.wallets.map((w) => (w.id === id ? { ...w, name } : w)),
        })),
    }),
    { name: "glowide-local-wallets" }
  )
);
