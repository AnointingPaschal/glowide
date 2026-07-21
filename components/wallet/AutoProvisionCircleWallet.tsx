"use client";
import { useEffect, useRef } from "react";
import { useCircleStore } from "@/store/circleStore";

/**
 * Silently creates a Circle Developer-Controlled Wallet in the background
 * the first time the app loads with none configured yet — no manual "Set
 * up" step needed. Circle Dev Wallets are server-signed (no PIN), so this
 * is safe to provision automatically; it just means a working, non-custodial
 * signable wallet always exists before the user ever tries to send anything
 * or lets the AI execute a transaction.
 *
 * Also repairs a real bug from an earlier version: wallets used to be
 * created on ETH-SEPOLIA while every transfer/contract call targets
 * ARC-TESTNET — Circle can't find a token on a chain the wallet was never
 * provisioned on, which is exactly the "Cannot find target token" error.
 * Anyone with a cached wallet from before this fix gets a fresh Arc-Testnet
 * wallet created automatically (same wallet set, so cheap and safe to redo).
 */
export function AutoProvisionCircleWallet() {
  const circle = useCircleStore();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;

    const needsWallet = circle.wallets.length === 0;
    const needsRepair  = circle.wallets.length > 0 && !circle.wallets.some(w => w.blockchain === "ARC-TESTNET");
    if (!needsWallet && !needsRepair) return;
    attempted.current = true;

    fetch("/api/circle/dev-wallet", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    })
      .then(r => r.json())
      .then((d: { wallet?: { id: string; address: string; blockchain: string }; error?: string }) => {
        if (d.error || !d.wallet) return; // fail silently — chat/DeFi will just fall back to MetaMask
        circle.setWallets([{
          id: d.wallet.id,
          address: d.wallet.address,
          blockchain: d.wallet.blockchain,
          accountType: "EOA",
          name: "Circle Dev Wallet",
          balances: [],
        }]);
        circle.setActive(d.wallet.id);
        circle.setInit(true);
      })
      .catch(() => { /* silent — not critical path, MetaMask still works as fallback */ });
  }, [circle]);

  return null;
}
