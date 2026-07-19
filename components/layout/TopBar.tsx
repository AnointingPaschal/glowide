"use client";
import Link from "next/link";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { usePathname } from "next/navigation";
import { Bell, Command, Wifi, WifiOff, Code2, MessageSquare, Rocket, Search, Wallet, Settings, Home, Zap, Menu, X, Hammer, Sun, Moon , TrendingUp } from "lucide-react";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/themeStore";

const NAV_ITEMS = [
  { href:"/",            icon:Home,         label:"Home"        },
  { href:"/chat",        icon:MessageSquare,label:"Chat"        },
  { href:"/editor",      icon:Code2,        label:"Editor"      },
  { href:"/build",       icon:Hammer,       label:"Build"       },
  { href:"/deployments", icon:Rocket,       label:"Deploy"      },
  { href:"/launchpad",   icon:Zap,          label:"Launchpad"   },
  { href:"/defi",        icon:TrendingUp,   label:"DeFi"        },
  { href:"/explorer",    icon:Search,       label:"Explorer"    },
  { href:"/wallet",      icon:Wallet,       label:"Wallet"      },
  { href:"/settings",    icon:Settings,     label:"Settings"    },
];

export function TopBar({ title: propTitle, description: propDesc }: { title?: string; description?: string } = {}) {
  const pathname = usePathname();
  const [networkOk] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useThemeStore();

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isLight = theme === "light";
  const siteSettings = useSiteSettings();

  return (
    <>
      <header className="h-12 md:h-14 border-b border-[var(--glow-border)] bg-[var(--glow-surface)]/90 backdrop-blur-md flex items-center gap-2 px-3 md:px-4 flex-shrink-0 z-30 relative">

        {/* Logo */}
        <Link href="/chat" className="flex items-center gap-2 flex-shrink-0 mr-1">
          {siteSettings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={siteSettings.logoUrl} alt={siteSettings.siteName} className="w-7 h-7 md:w-8 md:h-8 rounded-lg object-contain" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
          ) : (
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-glow-gradient flex items-center justify-center shadow-glow-sm">
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
          )}
          <span className="hidden sm:block font-bold text-sm glow-text">{siteSettings.siteName}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                isActive ? "bg-[var(--glow-accent)]/20 text-[var(--glow-accent-light)]" : "text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)]"
              )}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
              </Link>
            );
          })}
        </nav>

        {/* Tablet Nav */}
        <nav className="hidden md:flex lg:hidden items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} title={label} className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all",
                isActive ? "bg-[var(--glow-accent)]/20 text-[var(--glow-accent-light)]" : "text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)]"
              )}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn("hidden sm:flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border", networkOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
            {networkOk ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            <span className="hidden md:inline">Arc</span>
          </span>

          <div className="hidden xl:flex items-center gap-1 px-2 py-1 bg-[var(--glow-card)] border border-[var(--glow-border)] rounded-lg text-xs text-[var(--glow-muted)] cursor-pointer hover:border-[var(--glow-accent)]/40 transition-colors select-none">
            <Command className="w-3 h-3" /><span>K</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)] transition-colors"
            title={isLight ? "Switch to dark mode" : "Switch to light mode"}
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button className="relative p-1.5 rounded-lg text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)] transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--glow-accent)] rounded-full" />
          </button>

          <WalletButton />

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-lg text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)] transition-colors">
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 flex" style={{ top:"48px" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-[var(--glow-surface)] border-r border-[var(--glow-border)] flex flex-col shadow-card-shadow animate-slide-in-left">
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link key={href} href={href} className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                    isActive ? "bg-[var(--glow-accent)]/20 text-[var(--glow-accent-light)] border border-[var(--glow-accent)]/20" : "text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)]"
                  )}>
                    <Icon className="w-4 h-4 flex-shrink-0" />{label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--glow-accent)] animate-pulse" />}
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-[var(--glow-border)]">
                <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--glow-muted)] hover:text-[var(--glow-text)] hover:bg-[var(--glow-card)] transition-all">
                  {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {isLight ? "Dark Mode" : "Light Mode"}
                </button>
              </div>
            </nav>
            <div className="p-3 border-t border-[var(--glow-border)]">
              <div className="flex items-center gap-2 text-xs text-[var(--glow-muted)]">
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

function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="p-1.5 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-card transition-colors"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
