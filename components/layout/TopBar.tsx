"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Command, Wifi, WifiOff,
  Code2, MessageSquare, Rocket, Search,
  Wallet, Settings, Shield, Home, Zap, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/",            icon: Home,         label: "Home"        },
  { href: "/chat",        icon: MessageSquare,label: "Chat"        },
  { href: "/editor",      icon: Code2,        label: "Editor"      },
  { href: "/deployments", icon: Rocket,       label: "Deployments" },
  { href: "/explorer",    icon: Search,       label: "Explorer"    },
  { href: "/wallet",      icon: Wallet,       label: "Wallet"      },
  { href: "/settings",    icon: Settings,     label: "Settings"    },
  { href: "/admin",       icon: Shield,       label: "Admin"       },
];

interface TopBarProps {
  title?: string;
  description?: string;
}

export function TopBar({ title: propTitle, description: propDesc }: TopBarProps = {}) {
  const pathname = usePathname();
  const [networkOk] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const currentPage = NAV_ITEMS.find(n =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
  );

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-12 md:h-14 border-b border-glow-border bg-glow-surface/90 backdrop-blur-md flex items-center gap-2 px-3 md:px-4 flex-shrink-0 z-30 relative">

        {/* Logo */}
        <Link href="/chat" className="flex items-center gap-2 flex-shrink-0 mr-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-glow-gradient flex items-center justify-center shadow-glow-sm">
            <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </div>
          <span className="hidden sm:block font-bold text-sm md:text-base glow-text">GlowIDE</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-glow-accent/20 text-glow-accent-light"
                    : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Tablet Nav (icons only) */}
        <nav className="hidden md:flex lg:hidden items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isActive
                    ? "bg-glow-accent/20 text-glow-accent-light"
                    : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
                )}
              >
                <Icon className="w-4 h-4" />
              </Link>
            );
          })}
        </nav>

        {/* Spacer (mobile only) */}
        <div className="flex-1 md:hidden" />

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">

          {/* Network status */}
          <span className={cn(
            "hidden sm:flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border",
            networkOk
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          )}>
            {networkOk ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            <span className="hidden md:inline">Arc</span>
          </span>

          {/* Command palette hint (desktop) */}
          <div className="hidden xl:flex items-center gap-1 px-2 py-1 bg-glow-card border border-glow-border rounded-lg text-xs text-glow-muted cursor-pointer hover:border-glow-accent/40 transition-colors select-none">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>

          {/* Notifications */}
          <button className="relative p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-glow-accent rounded-full" />
          </button>

          {/* Wallet */}
          <WalletButton />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"
            aria-label="Open navigation"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Mobile Nav Drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 flex" style={{ top: "48px" }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-64 max-w-[80vw] bg-glow-surface border-r border-glow-border flex flex-col shadow-card-shadow animate-slide-in-left">
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                      isActive
                        ? "bg-glow-accent/20 text-glow-accent-light border border-glow-accent/20"
                        : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-glow-accent-light")} />
                    {label}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-glow-accent animate-pulse" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Network footer */}
            <div className="p-3 border-t border-glow-border">
              <div className="flex items-center gap-2 text-xs text-glow-muted">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Arc Testnet · Chain 5042002</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
