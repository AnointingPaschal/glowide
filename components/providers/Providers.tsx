"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: { decimals: 6, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http() },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#16162a",
              color: "#e2e8f0",
              border: "1px solid #252540",
              borderRadius: "8px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#16162a" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#16162a" },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
