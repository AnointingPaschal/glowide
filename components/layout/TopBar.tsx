"use client";
import { usePathname } from "next/navigation";
import { Bell, Command, Search, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useState } from "react";
import { cn } from "@/lib/utils";

const pageLabels: Record<string, { title: string; desc: string }> = {
  "/": { title: "Dashboard", desc: "Welcome to GlowIDE" },
  "/editor": { title: "Code Editor", desc: "Build and write code" },
  "/chat": { title: "AI Assistant", desc: "Chat with your coding assistant" },
  "/deployments": { title: "Deployments", desc: "Manage your deployed contracts" },
  "/explorer": { title: "Explorer", desc: "Browse Arc Testnet" },
  "/wallet": { title: "Wallet", desc: "Manage your assets" },
  "/admin": { title: "Admin Panel", desc: "Configure GlowIDE" },
  "/settings": { title: "Settings", desc: "Your preferences" },
};

interface TopBarProps {
  title?: string;
  description?: string;
}

export function TopBar({ title: propTitle, description: propDesc }: TopBarProps = {}) {
  const pathname = usePathname();
  const [networkStatus] = useState(true);
  const pageFallback = pageLabels[pathname] || pageLabels["/"];
  const page = { title: propTitle || pageFallback.title, desc: propDesc || pageFallback.desc };

  return (
    <header className="h-14 border-b border-glow-border bg-glow-surface/80 backdrop-blur-sm flex items-center gap-4 px-4 flex-shrink-0">
      {/* Page info */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-glow-text">{page.title}</h1>
            <span className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              networkStatus
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              {networkStatus ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
              Arc Testnet
            </span>
          </div>
          <p className="text-xs text-glow-muted">{page.desc}</p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Command palette hint */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted cursor-pointer hover:border-glow-accent/40 transition-colors">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-glow-accent rounded-full" />
        </Button>

        {/* Wallet */}
        <WalletButton />
      </div>
    </header>
  );
}
