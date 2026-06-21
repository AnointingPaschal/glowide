"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWalletStore } from "@/store/walletStore";

export function PageTracker() {
  const pathname = usePathname();
  const { address } = useWalletStore();

  useEffect(() => {
    if (!pathname) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page:   pathname,
        event:  "pageview",
        wallet: address ?? null,
      }),
    }).catch(() => {});
  }, [pathname, address]);

  return null;
}

export function trackEvent(event: string, props?: Record<string, string|number|boolean|null>) {
  if (typeof window === "undefined") return;
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page: window.location.pathname, event, ...props }),
  }).catch(() => {});
}
