"use client";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Code2, MessageSquare, Rocket, Search, Wallet, Zap, ArrowRight, GitBranch, Shield, Cpu, Globe } from "lucide-react";
import { useWalletStore } from "@/store/walletStore";
import { truncateAddress } from "@/lib/utils";

const features = [
  { icon: <Code2 className="w-5 h-5" />, title: "Monaco Editor", desc: "VS Code-quality editor with Solidity, TypeScript, Python support", color: "text-glow-cyan" },
  { icon: <MessageSquare className="w-5 h-5" />, title: "AI Assistant", desc: "OpenRouter-powered coding assistant with Web3 expertise", color: "text-glow-accent-light" },
  { icon: <Rocket className="w-5 h-5" />, title: "Arc Testnet Deploy", desc: "Compile, test, and deploy contracts with USDC gas", color: "text-emerald-400" },
  { icon: <Search className="w-5 h-5" />, title: "Chain Explorer", desc: "Browse addresses, transactions, and contracts on Arc", color: "text-amber-400" },
  { icon: <Wallet className="w-5 h-5" />, title: "Circle Assets", desc: "USDC, EURC, and cirBTC balance tracking and transfers", color: "text-glow-cyan" },
  { icon: <Shield className="w-5 h-5" />, title: "Security First", desc: "Audited contract templates and security scanning", color: "text-purple-400" },
];

const quickActions = [
  { href: "/editor", icon: <Code2 className="w-4 h-4" />, label: "Open Editor", desc: "Start coding" },
  { href: "/chat", icon: <MessageSquare className="w-4 h-4" />, label: "Ask AI", desc: "Get help" },
  { href: "/deployments", icon: <Rocket className="w-4 h-4" />, label: "Deployments", desc: "Your contracts" },
  { href: "/explorer", icon: <Search className="w-4 h-4" />, label: "Explorer", desc: "Browse chain" },
];

export default function HomePage() {
  const { address, isConnected } = useWalletStore();

  return (
    <AppLayout>
      <div className="min-h-full bg-hero-gradient">
        {/* Hero */}
        <div className="relative px-6 py-12 max-w-5xl mx-auto">
          {/* Glow orbs */}
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-glow-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-12 right-1/4 w-48 h-48 bg-glow-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-glow-accent/10 border border-glow-accent/20 rounded-full text-xs text-glow-accent-light mb-4">
              <Zap className="w-3 h-3" />
              AI-Powered Web3 Development Platform
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              <span className="glow-text">GlowIDE</span>
            </h1>
            <p className="text-lg text-glow-muted max-w-xl mx-auto mb-6">
              The premium IDE for Web3 developers. Write smart contracts, chat with AI, and deploy to Arc Testnet — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/editor">
                <Button variant="gradient" size="lg" className="gap-2 shadow-glow-md">
                  <Code2 className="w-4 h-4" />
                  Open Editor
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" size="lg" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat with AI
                </Button>
              </Link>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-glow-muted">Arc Testnet</span>
              <Badge variant="success">Chain 5042002</Badge>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="w-3.5 h-3.5 text-glow-muted" />
                <span className="text-glow-muted font-mono">{truncateAddress(address!)}</span>
                <Badge variant="info">Connected</Badge>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {quickActions.map(action => (
              <Link key={action.href} href={action.href}>
                <Card glow className="flex items-center gap-3 cursor-pointer hover:border-glow-accent/40 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-glow-accent/20 flex items-center justify-center text-glow-accent-light flex-shrink-0">
                    {action.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-glow-text">{action.label}</div>
                    <div className="text-xs text-glow-muted">{action.desc}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Features grid */}
          <div className="mb-10">
            <h2 className="text-xl font-bold text-glow-text text-center mb-6">Everything you need to build on Web3</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(f => (
                <Card key={f.title} className="flex gap-3">
                  <div className={`mt-0.5 flex-shrink-0 ${f.color}`}>{f.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-glow-text mb-0.5">{f.title}</h3>
                    <p className="text-xs text-glow-muted">{f.desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Languages", value: "10+" },
              { label: "Chain ID", value: "5042002" },
              { label: "Gas Token", value: "USDC" },
            ].map(stat => (
              <Card key={stat.label} className="py-4">
                <div className="text-2xl font-bold glow-text">{stat.value}</div>
                <div className="text-xs text-glow-muted mt-0.5">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
