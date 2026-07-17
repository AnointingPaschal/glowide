import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CircleWalletEntry {
  id: string;
  address: string;
  blockchain: string;
  accountType: "EOA" | "SCA";
  name?: string;
  balances?: Array<{ token: { symbol: string; name: string; decimals: number }; amount: string }>;
}

export interface CircleTx {
  id: string; txHash?: string; state: string; amounts?: string[];
  destinationAddress?: string; createDate: string; transactionType: string;
}

interface CircleState {
  // User session
  circleUserId:  string | null;
  userToken:     string | null;
  encryptionKey: string | null;
  tokenExpiry:   number | null;

  // Wallets
  wallets:  CircleWalletEntry[];
  activeWalletId: string | null;

  // Transactions
  txHistory: CircleTx[];

  // Auth status
  isInitialized: boolean;
  hasPinSet:     boolean;

  // SDK challenge in-flight
  pendingChallengeId: string | null;

  // Actions
  setSession:  (uid: string, token: string, key: string, expiry: number) => void;
  setWallets:  (w: CircleWalletEntry[]) => void;
  setActive:   (id: string | null) => void;
  appendTx:    (tx: CircleTx) => void;
  setInit:     (v: boolean) => void;
  setPinSet:   (v: boolean) => void;
  setPending:  (id: string | null) => void;
  clearSession: () => void;
}

export const useCircleStore = create<CircleState>()(
  persist(
    (set) => ({
      circleUserId:   null,
      userToken:      null,
      encryptionKey:  null,
      tokenExpiry:    null,
      wallets:        [],
      activeWalletId: null,
      txHistory:      [],
      isInitialized:  false,
      hasPinSet:      false,
      pendingChallengeId: null,

      setSession:  (uid, token, key, expiry) =>
        set({ circleUserId: uid, userToken: token, encryptionKey: key, tokenExpiry: expiry }),
      setWallets:  (wallets)  => set({ wallets }),
      setActive:   (id)       => set({ activeWalletId: id }),
      appendTx:    (tx)       => set(s => ({ txHistory: [tx, ...s.txHistory].slice(0, 100) })),
      setInit:     (v)        => set({ isInitialized: v }),
      setPinSet:   (v)        => set({ hasPinSet: v }),
      setPending:  (id)       => set({ pendingChallengeId: id }),
      clearSession: () =>
        set({ circleUserId: null, userToken: null, encryptionKey: null, tokenExpiry: null,
              wallets: [], activeWalletId: null, isInitialized: false, hasPinSet: false }),
    }),
    {
      name: "glowide-circle-wallet",
      partialize: (s) => ({
        circleUserId:   s.circleUserId,
        userToken:      s.userToken,
        encryptionKey:  s.encryptionKey,
        tokenExpiry:    s.tokenExpiry,
        wallets:        s.wallets,
        activeWalletId: s.activeWalletId,
        isInitialized:  s.isInitialized,
        hasPinSet:      s.hasPinSet,
      }),
    }
  )
);
