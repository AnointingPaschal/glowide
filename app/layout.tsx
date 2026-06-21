import { PageTracker } from "@/components/analytics/PageTracker";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | GlowIDE",
    default: "GlowIDE — AI-Powered Web3 IDE",
  },
  description:
    "The premium AI-powered IDE for Web3 development. Write, deploy, and interact with smart contracts on Arc Testnet. Powered by OpenRouter.",
  keywords: ["IDE", "Web3", "Solidity", "AI", "Smart Contracts", "Arc Testnet", "USDC"],
  authors: [{ name: "GlowIDE" }],
  openGraph: {
    title: "GlowIDE — AI-Powered Web3 IDE",
    description: "Build smarter on Web3 with AI-assisted development and Arc Testnet integration.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-glow-bg text-glow-text antialiased">
        <Providers>{children}<PageTracker/></Providers>
    </body>
    </html>
  );
}
