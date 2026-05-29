"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";
import { useState, useMemo } from "react";
import { useThemeStore } from "@/store/themeStore";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 6, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] },
    public:  { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export function RainbowProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  // Create config and queryClient once per mount — never at module level
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
  }));

  const wagmiConfig = useMemo(() => getDefaultConfig({
    appName: "GlowIDE",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "3b3f517bd5ffbf21f38d5d3c69a4ccb9",
    chains: [arcTestnet],
    ssr: false, // Disable SSR to prevent static-gen crashes
  }), []);

  const rkTheme = theme === "dark"
    ? darkTheme({ accentColor: "#7c3aed", accentColorForeground: "white", borderRadius: "large" })
    : lightTheme({ accentColor: "#7c3aed", accentColorForeground: "white", borderRadius: "large" });

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} coolMode>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
