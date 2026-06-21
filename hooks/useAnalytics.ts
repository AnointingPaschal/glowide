"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWalletStore } from "@/store/walletStore";

export function useAnalytics() {
  const pathname = usePathname();
  const { address } = useWalletStore();

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pathname, event: "pageview", wallet: address ?? null }),
    }).catch(() => {}); // silent — never block UI
  }, [pathname, address]);
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const address = (() => { try { return JSON.parse(localStorage.getItem("wallet-store") ?? "{}").state?.address; } catch { return null; } })();
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page: window.location.pathname, event, wallet: address, ...data }),
  }).catch(() => {});
}
