"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Code2, MessageSquare, Rocket, Search, Wallet, Settings, Shield, Zap, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/editor", icon: Code2, label: "Editor" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/deployments", icon: Rocket, label: "Deployments" },
  { href: "/explorer", icon: Search, label: "Explorer" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
];

const bottomItems = [
  { href: "/admin", icon: Shield, label: "Admin" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar-gradient border-r border-glow-border transition-all duration-300 relative z-10",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-glow-border">
        <div className="w-8 h-8 rounded-lg bg-glow-gradient flex items-center justify-center flex-shrink-0 shadow-glow-sm">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-base glow-text">GlowIDE</span>
            <div className="text-[10px] text-glow-muted">Web3 Dev Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
              isActive
                ? "bg-glow-accent/20 text-glow-accent-light border border-glow-accent/30"
                : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
            )}>
              <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-glow-accent-light")} />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
              {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-glow-accent animate-pulse" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-glow-border space-y-1">
        {bottomItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
              isActive ? "bg-glow-accent/20 text-glow-accent-light" : "text-glow-muted hover:text-glow-text hover:bg-glow-card"
            )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-glow-card border border-glow-border rounded-full flex items-center justify-center text-glow-muted hover:text-glow-text transition-colors shadow-card-shadow"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
