import { PageTracker } from "@/components/analytics/PageTracker";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

// Fetched at request time so the favicon/title reflect whatever's actually
// been uploaded in Admin → Website — not a build-time snapshot.
export async function generateMetadata(): Promise<Metadata> {
  let siteName = "GlowIDE";
  let siteDescription = "The premium AI-powered IDE for Web3 development. Write, deploy, and interact with smart contracts on Arc Testnet. Powered by OpenRouter.";
  let logoUrl: string | undefined;

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/admin/public-settings`, { next: { revalidate: 300 } });
    if (res.ok) {
      const d = await res.json() as { site_name?: string; site_description?: string; logo_url?: string };
      if (d.site_name)        siteName = d.site_name;
      if (d.site_description) siteDescription = d.site_description;
      if (d.logo_url)         logoUrl = d.logo_url;
    }
  } catch { /* fall back to defaults below */ }

  return {
    title: {
      template: `%s | ${siteName}`,
      default: `${siteName} — AI-Powered Web3 IDE`,
    },
    description: siteDescription,
    keywords: ["IDE", "Web3", "Solidity", "AI", "Smart Contracts", "Arc Testnet", "USDC"],
    authors: [{ name: siteName }],
    openGraph: {
      title: `${siteName} — AI-Powered Web3 IDE`,
      description: "Build smarter on Web3 with AI-assisted development and Arc Testnet integration.",
      type: "website",
    },
    icons: logoUrl ? { icon: logoUrl, shortcut: logoUrl, apple: logoUrl } : undefined,
  };
}

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
