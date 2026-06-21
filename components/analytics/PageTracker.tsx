"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWalletStore } from "@/store/walletStore";

export function PageTracker() {
  const pathname  = usePathname();
  const { address } = useWalletStore();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    // Deduplicate — don't track the same path twice in a row
    const key = `${pathname}|${address ?? ""}`;
    if (lastTracked.current === key) return;
    lastTracked.current = key;

    fetch("/api/analytics", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page:   pathname,
        event:  "pageview",
        wallet: address ?? null,
      }),
    }).catch((err) => console.warn("[Analytics] tracking failed:", err));
  }, [pathname, address]);

  return null;
}

// Call from anywhere to track a custom event
export function trackEvent(
  event: string,
  props?: Record<string, string | number | boolean | null>
) {
  if (typeof window === "undefined") return;
  fetch("/api/analytics", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page:  window.location.pathname,
      event,
      ...props,
    }),
  }).catch(() => {});
}
