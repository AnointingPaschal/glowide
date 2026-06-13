'use client';
export const dynamic = 'force-dynamic';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Terminal, Bot, Code2, Rocket, Search, Shield, Server,
  Link as LinkIcon, Globe, Target, Cpu, Zap, Coins, Users,
  CheckCircle2, XCircle, ArrowRight, Activity, Box
} from 'lucide-react';
import Link from 'next/link';

export default function PitchPage() {
  return (
    <AppLayout 
      title="Glow IDE Pitch" 
      description="The Ultimate AI-Native Web3 Developer Platform"
    >
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-32">
        
        {/* Background Gradients (matching your glow aesthetic) */}
        <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-glow-accent/5 blur-[120px] pointer-events-none z-[-1]" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none z-[-1]" />

        {/* 1. HERO SECTION */}
        <section className="text-center pt-20 pb-10 animate-fade-in">
          <Badge className="mb-8 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2 inline-block" />
            Arc Testnet Integrated & Live
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-white">
            One Browser Tab.<br />
            <span className="bg-gradient-to-r from-white via-glow-cyan to-glow-accent bg-clip-text text-transparent">
              Zero Friction.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-glow-muted max-w-3xl mx-auto mb-10 leading-relaxed">
            The ultimate AI-native workspace accelerating Web3 development. Write, compile, test, and deploy smart contracts to the Arc network in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="gradient" className="w-full sm:w-auto px-8 py-6 text-base" asChild>
              <Link href="#platform">Explore Platform <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button variant="outline" className="w-full sm:w-auto px-8 py-6 text-base border-glow-border hover:bg-glow-surface" asChild>
              <Link href="/workspace">Launch Workspace</Link>
            </Button>
          </div>
        </section>

        {/* 2. THE PROBLEM */}
        <section id="problem" className="scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-red-400 font-semibold tracking-wider text-xs uppercase mb-3 block">The Status Quo</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Web3 Development is Broken.</h2>
            <p className="text-glow-muted leading-relaxed">
              To deploy a single smart contract today, developers juggle local IDEs, fragile Node environments, complex compilers, and testnet faucets. The constant context switching destroys productivity and prevents millions of Web2 developers from transitioning to Web3.
            </p>
          </div>

          <Card className="max-w-4xl mx-auto border-red-500/20 bg-red-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1117] border-b border-red-500/20">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-4 text-xs font-mono text-glow-muted">Terminal — Local Environment</span>
            </div>
            <div className="p-6 font-mono text-sm space-y-4">
              <div>
                <span className="text-glow-text">$ npx hardhat compile</span><br />
                <span className="text-red-400">Error HH8: There's one or more errors in your config file. Missing solc dependencies.</span>
              </div>
              <div>
                <span className="text-glow-text">$ npm install</span><br />
                <span className="text-amber-400">WARN ERESOLVE overriding peer dependency...</span>
              </div>
              <div>
                <span className="text-glow-text">$ npx hardhat run scripts/deploy.js --network arc_testnet</span><br />
                <span className="text-red-400">ProviderError: Invalid RPC URL or insufficient funds for gas.</span><br />
                <span className="text-glow-muted">Failed to connect to MetaMask. Attempting reconnect... <span className="animate-pulse inline-block w-2 h-4 bg-glow-cyan align-middle ml-1" /></span>
              </div>
            </div>
          </Card>
        </section>

        {/* 3. PRODUCT SUITE */}
        <section id="platform" className="scroll-mt-24 space-y-24">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-glow-cyan font-semibold tracking-wider text-xs uppercase mb-3 block">The Glow Solution</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">The Complete Product Suite</h2>
            <p className="text-glow-muted leading-relaxed">
              We've abstracted away the infrastructure so you can focus purely on logic. Everything a builder needs, natively integrated into one premium, zero-config environment.
            </p>
          </div>

          {/* Feature: AI */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-12 h-12 rounded-xl bg-glow-cyan/10 border border-glow-cyan/20 flex items-center justify-center mb-6">
                <Bot className="w-6 h-6 text-glow-cyan" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Context-Aware AI Assistant</h3>
              <p className="text-glow-muted mb-6">
                Not just an LLM wrapper. A senior Web3 pair programmer embedded directly into your workspace, inherently aware of the Arc ecosystem's unique architecture.
              </p>
              <ul className="space-y-3">
                {['Pre-trained on Arc documentation and USDC gas mechanics', 'Automated security audits for reentrancy and overflows', '1-click complex contract architecture injection'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-glow-text">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="overflow-hidden border-glow-cyan/20 bg-glow-cyan/5">
               <div className="px-4 py-3 bg-[#0d1117] border-b border-glow-border flex items-center gap-2">
                 <Terminal className="w-4 h-4 text-glow-cyan" />
                 <span className="text-xs font-mono text-glow-muted">Glow AI</span>
               </div>
               <div className="p-6 text-sm space-y-4">
                 <p><span className="text-glow-accent font-semibold">You:</span> Write an Arc Testnet ERC-20 token that charges a 1% USDC fee.</p>
                 <p><span className="text-emerald-400 font-semibold">Glow AI:</span> Drafted `FeeToken.sol`. It utilizes Arc's native USDC for the fee mechanism with built-in reentrancy guards.</p>
                 <Button variant="outline" size="sm" className="w-full mt-2 border-glow-cyan/30 text-glow-cyan hover:bg-glow-cyan/10">
                   Load Code into Editor
                 </Button>
               </div>
            </Card>
          </div>

          {/* Feature: Coder Studio */}
          <div className="grid md:grid-cols-2 gap-12 items-center md:flex-row-reverse">
            <Card className="overflow-hidden border-amber-500/20 bg-amber-500/5 md:order-last">
               <div className="px-4 py-3 bg-[#0d1117] border-b border-glow-border flex items-center gap-2">
                 <Code2 className="w-4 h-4 text-amber-400" />
                 <span className="text-xs font-mono text-glow-muted">Workspace.sol</span>
               </div>
               <div className="p-6 font-mono text-sm text-glow-text space-y-1">
                 <p><span className="text-pink-400">pragma</span> <span className="text-blue-400">solidity</span> ^0.8.20;</p>
                 <p className="text-glow-muted mt-2">/**</p>
                 <p className="text-glow-muted"> * @dev Arc Testnet Contract</p>
                 <p className="text-glow-muted"> */</p>
                 <p><span className="text-pink-400">contract</span> <span className="text-emerald-300">GlowSub</span> {'{'}</p>
                 <p>&nbsp;&nbsp;<span className="text-blue-400">address</span> <span className="text-pink-400">public</span> owner;</p>
                 <p>&nbsp;&nbsp;<span className="text-pink-400">function</span> <span className="text-emerald-300">pay</span>() <span className="text-pink-400">external</span> {'{'}</p>
                 <p>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-glow-muted">// Logic executes here<span className="animate-pulse inline-block w-2 h-4 bg-glow-accent align-middle ml-1" /></span></p>
                 <p>&nbsp;&nbsp;{'}'}</p>
                 <p>{'}'}</p>
               </div>
            </Card>
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Code2 className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">The Coder Studio</h3>
              <p className="text-glow-muted mb-6">
                A desktop-grade IDE experience running entirely in the browser. Write code with zero latency and compile to EVM bytecode instantly.
              </p>
              <ul className="space-y-3">
                {['Cloud Compiler Middleware for instant ABI generation', 'Fault-tolerant UI with deterministic mock-compilation', 'Real-time syntax highlighting and intelligent autocompletion'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-glow-text">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Add more alternating rows for Launchpad & Explorer following the pattern above if needed... */}
        </section>

        {/* 4. ARCHITECTURE */}
        <section id="architecture" className="scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Enterprise-Grade Architecture</h2>
            <p className="text-glow-muted">Built on a proprietary stack designed for high-availability Web3 execution.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: 'Non-Custodial Security', desc: 'We never hold private keys. All signing happens client-side via wallet injection. Backend only handles compilation.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { icon: Server, title: 'Session Middleware', desc: 'Custom middleware securely bridges Web2/Web3, linking EVM addresses with persistent sessions without forced emails.', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { icon: LinkIcon, title: 'On-Chain Anchoring', desc: 'Immutable audit trails. Hash AI-generated code directly to the Arc blockchain for verifiable proof of work and IP.', color: 'text-glow-cyan', bg: 'bg-glow-cyan/10', border: 'border-glow-cyan/20' },
            ].map((arch, i) => (
              <Card key={i} className="p-6 bg-glow-surface/30">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border ${arch.bg} ${arch.border}`}>
                  <arch.icon className={`w-6 h-6 ${arch.color}`} />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{arch.title}</h4>
                <p className="text-sm text-glow-muted leading-relaxed">{arch.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* 5. MARKET & MOAT */}
        <section className="space-y-12">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-8 text-center bg-glow-surface/30">
              <div className="text-4xl font-bold text-white mb-2">30M+</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-glow-muted mb-4">Total Addressable Market</div>
              <p className="text-sm text-glow-muted">Global software developers. Bridging Web2 engineers into Web3.</p>
            </Card>
            <Card className="p-8 text-center border-glow-cyan/20 bg-glow-cyan/5">
              <div className="text-4xl font-bold text-glow-cyan mb-2">500k</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-glow-cyan mb-4">Serviceable Market</div>
              <p className="text-sm text-glow-muted">Active monthly Web3 devs escaping fragmented legacy tooling.</p>
            </Card>
            <Card className="p-8 text-center border-emerald-500/20 bg-emerald-500/5">
              <div className="text-4xl font-bold text-emerald-400 mb-2">Arc</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-4">Obtainable Market</div>
              <p className="text-sm text-glow-muted">Capturing the rapidly growing Arc ecosystem as the official IDE.</p>
            </Card>
          </div>

          {/* Competitor Table */}
          <Card className="p-0 overflow-hidden bg-glow-surface/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-glow-muted uppercase bg-glow-surface/50 border-b border-glow-border">
                  <tr>
                    <th className="px-6 py-4">Value Proposition</th>
                    <th className="px-6 py-4">VS Code + Hardhat</th>
                    <th className="px-6 py-4">Remix IDE</th>
                    <th className="px-6 py-4 bg-glow-accent/10 text-glow-accent">Glow IDE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glow-border">
                  {[
                    { prop: 'Onboarding Velocity', a: 'Hours (Local Configs)', b: 'Minutes', c: 'Instant (Browser Native)' },
                    { prop: 'AI Synergy', a: 'Generic Plugins', b: 'Basic Auto-complete', c: 'Native Senior-Pair Logic' },
                    { prop: 'Arc Integration', a: 'Manual RPC Setup', b: 'Fragmented', c: '1-Click Testnet Native' },
                    { prop: 'Gas Economics', a: 'Manual USDC bridging', b: 'Complex calcs', c: 'Automated USDC Engine' },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-glow-surface/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.prop}</td>
                      <td className="px-6 py-4 text-glow-muted flex items-center gap-2"><XCircle className="w-4 h-4 text-red-400" /> {row.a}</td>
                      <td className="px-6 py-4 text-glow-muted flex items-center gap-2"><XCircle className="w-4 h-4 text-red-400" /> {row.b}</td>
                      <td className="px-6 py-4 font-medium text-emerald-400 bg-glow-accent/5 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {row.c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* 6. BUSINESS MODEL */}
        <section id="business" className="scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">The Growth Flywheel</h2>
            <p className="text-glow-muted">A self-sustaining ecosystem with clear paths to monetization and deep retention.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-glow-surface/30 text-center">
              <Coins className="w-10 h-10 mx-auto mb-4 text-glow-cyan" />
              <h3 className="font-bold text-white mb-2">Web3 SaaS (USDC)</h3>
              <p className="text-sm text-glow-muted">Premium upgrades directly via smart contracts using native USDC. No fiat gateways required.</p>
            </Card>
            <Card className="p-6 bg-glow-surface/30 text-center border-amber-500/20">
              <Activity className="w-10 h-10 mx-auto mb-4 text-amber-400" />
              <h3 className="font-bold text-white mb-2">Tokenized Retention</h3>
              <p className="text-sm text-glow-muted">Developers earn GLOW tokens for deploying code, gamifying development and creating network effects.</p>
            </Card>
            <Card className="p-6 bg-glow-surface/30 text-center border-purple-500/20">
              <Users className="w-10 h-10 mx-auto mb-4 text-purple-400" />
              <h3 className="font-bold text-white mb-2">Protocol B2B Deals</h3>
              <p className="text-sm text-glow-muted">White-labeling the Glow IDE environment for other Layer-1/2 networks to improve their onboarding metrics.</p>
            </Card>
          </div>
        </section>

        {/* 7. ROADMAP */}
        <section id="roadmap" className="scroll-mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Product Roadmap</h2>
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-glow-border before:to-transparent">
            {[
              { phase: 'Phase 1 (Current)', title: 'The Foundation', desc: 'Glow IDE Beta. Deep Arc Testnet integration. Core AI code generation, solc compilation middleware, and 1-click USDC-gas deployments.', active: true },
              { phase: 'Phase 2', title: 'Advanced Testing & Auditing', desc: 'Integrated AI security audits (Slither equivalents) and local browser-based blockchain simulation for zero-cost testing.' },
              { phase: 'Phase 3', title: 'The App Marketplace', desc: 'Launch of Glow Templates. Top developers sell complex, audited architectures to other users directly for USDC.' },
              { phase: 'Phase 4', title: 'Mainnet & Cross-Chain', desc: 'Arc Mainnet support and strategic expansion to EVM L2s utilizing Circle CCTP for cross-chain deployments.' },
            ].map((step, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-glow-bg bg-glow-surface shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${step.active ? 'border-glow-accent bg-glow-accent/20' : ''}`}>
                  {step.active ? <CheckCircle2 className="w-5 h-5 text-glow-accent" /> : <Box className="w-4 h-4 text-glow-muted" />}
                </div>
                <Card className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 ${step.active ? 'border-glow-accent/30 bg-glow-accent/5' : 'bg-glow-surface/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold uppercase tracking-widest ${step.active ? 'text-glow-accent' : 'text-glow-muted'}`}>{step.phase}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-glow-muted">{step.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-20 border-t border-glow-border relative">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-glow-accent to-transparent opacity-50" />
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Build the Future?</h2>
          <p className="text-glow-muted mb-8 max-w-2xl mx-auto">
            Whether you're an enterprise looking to scale, a developer looking to build, or a protocol looking to partner, Glow IDE is your workspace.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="gradient" className="px-8 py-6 text-base" asChild>
              <Link href="/workspace">Launch Workspace <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </section>

      </div>
    </AppLayout>
  );
}
