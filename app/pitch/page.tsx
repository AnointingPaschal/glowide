"use client";
import { useEffect } from "react";

export default function PitchPage() {
  useEffect(() => {
    // Sticky nav
    const nav = document.getElementById("navbar");
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 50) nav.classList.add("scrolled");
      else nav.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll);

    // Reveal on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("active"); observer.unobserve(e.target); }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => { window.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, []);

  return (
    <>
      <style>{`
        :root{--bg:#030712;--surface:rgba(10,15,30,.4);--surface-hover:rgba(15,25,45,.8);--border:rgba(56,139,253,.15);--border-glow:rgba(56,139,253,.4);--blue:#388bfd;--bright:#58a6ff;--green:#3fb950;--gold:#e2b714;--red:#f85149;--purple:#a855f7;--text:#f8fafc;--text-dim:#8b949e;--font-heading:'Clash Display',sans-serif;--font-body:'Outfit',sans-serif;--font-mono:'JetBrains Mono',monospace}
        *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
        body{background-color:var(--bg);color:var(--text);font-family:var(--font-body);overflow-x:hidden;line-height:1.6;-webkit-font-smoothing:antialiased}
        .bg-glow{position:fixed;top:-20%;left:-10%;width:60vw;height:60vw;background:radial-gradient(circle,rgba(56,139,253,.06) 0%,transparent 60%);z-index:-1;pointer-events:none}
        .bg-glow-right{position:fixed;bottom:-20%;right:-10%;width:50vw;height:50vw;background:radial-gradient(circle,rgba(168,85,247,.04) 0%,transparent 60%);z-index:-1;pointer-events:none}
        .bg-grid{position:fixed;inset:0;z-index:-2;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(to bottom,black 10%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 10%,transparent 100%)}
        h1,h2,h3,h4{font-family:var(--font-heading);font-weight:600;line-height:1.1}
        .gradient-text{background:linear-gradient(135deg,#fff 20%,var(--bright) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 40px;display:flex;justify-content:space-between;align-items:center;transition:all .3s ease;border-bottom:1px solid transparent}
        nav.scrolled{background:rgba(3,7,18,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:15px 40px}
        .logo{display:flex;align-items:center;gap:10px;font-family:var(--font-heading);font-size:20px;font-weight:700;color:white;text-decoration:none}
        .logo-orb{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#1f6feb,var(--blue));display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(56,139,253,.4)}
        .logo-orb svg{width:16px;height:16px;stroke:white;stroke-width:2.5;fill:none}
        .nav-links{display:flex;gap:32px}
        .nav-links a{color:var(--text-dim);text-decoration:none;font-size:14px;font-weight:500;transition:.2s}
        .nav-links a:hover{color:white}
        .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1f6feb,var(--blue));color:white;padding:10px 24px;border-radius:100px;text-decoration:none;font-weight:600;font-size:14px;transition:all .3s ease;border:1px solid rgba(255,255,255,.1);cursor:pointer;box-shadow:0 4px 15px rgba(56,139,253,.3)}
        .btn-primary:hover{box-shadow:0 6px 25px rgba(56,139,253,.5);transform:translateY(-2px);border-color:rgba(255,255,255,.3)}
        .btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgba(56,139,253,.05);color:var(--bright);padding:10px 24px;border-radius:100px;text-decoration:none;font-weight:600;font-size:14px;transition:all .3s ease;border:1px solid var(--border-glow);cursor:pointer}
        .btn-outline:hover{background:rgba(56,139,253,.15);transform:translateY(-2px)}
        .container{max-width:1200px;margin:0 auto;padding:0 24px}
        section{padding:120px 0;position:relative}
        .section-header{text-align:center;margin-bottom:60px;max-width:800px;margin-left:auto;margin-right:auto}
        .section-header h2{font-size:48px;margin-bottom:20px;letter-spacing:-.5px}
        .section-header p{font-size:18px;color:var(--text-dim);line-height:1.6}
        .reveal{opacity:0;transform:translateY(30px);transition:all .8s cubic-bezier(.16,1,.3,1)}
        .reveal.active{opacity:1;transform:translateY(0)}
        .delay-1{transition-delay:.1s}.delay-2{transition-delay:.2s}
        .hero{text-align:center;padding:200px 0 120px}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.2);border-radius:100px;font-size:12px;font-weight:700;color:var(--green);margin-bottom:24px;text-transform:uppercase;letter-spacing:.5px}
        .pulse-dot{display:inline-block;width:6px;height:6px;background:var(--green);border-radius:50%;box-shadow:0 0 10px var(--green);animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .hero h1{font-size:clamp(52px,7vw,96px);letter-spacing:-2px;margin-bottom:24px;line-height:1.05}
        .hero p{font-size:clamp(18px,2vw,22px);color:var(--text-dim);max-width:750px;margin:0 auto 40px;line-height:1.6}
        .bento-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
        .bento-card{background:var(--surface);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:24px;padding:40px;position:relative;overflow:hidden;transition:all .4s ease}
        .bento-card:hover{border-color:var(--border-glow);transform:translateY(-5px);box-shadow:0 20px 40px rgba(0,0,0,.4),0 0 0 1px rgba(56,139,253,.1) inset;background:var(--surface-hover)}
        .col-12{grid-column:span 12}.col-8{grid-column:span 8}.col-6{grid-column:span 6}.col-4{grid-column:span 4}.col-3{grid-column:span 3}
        .bento-icon{width:56px;height:56px;border-radius:16px;background:rgba(56,139,253,.1);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin-bottom:24px;color:var(--bright)}
        .bento-card h3{font-size:26px;margin-bottom:12px;color:white}
        .bento-card p{color:var(--text-dim);font-size:16px;line-height:1.6}
        .feature-row{display:flex;align-items:center;gap:60px;margin-bottom:100px}
        .feature-row:nth-child(even){flex-direction:row-reverse}
        .feature-text{flex:1}.feature-visual{flex:1;position:relative}
        .feature-label{font-size:13px;font-weight:700;color:var(--bright);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px;display:inline-block}
        .feature-text h3{font-size:40px;margin-bottom:20px;line-height:1.1;letter-spacing:-1px}
        .feature-text p{font-size:18px;color:var(--text-dim);margin-bottom:24px;line-height:1.7}
        .feature-list{list-style:none;margin-bottom:30px}
        .feature-list li{position:relative;padding-left:28px;margin-bottom:16px;font-size:16px;color:var(--text)}
        .feature-list li::before{content:'✓';position:absolute;left:0;top:2px;color:var(--green);font-weight:bold}
        .mockup-window{background:#010409;border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.6);position:relative}
        .mockup-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#0d1117;border-bottom:1px solid var(--border)}
        .mockup-header-left{display:flex;align-items:center;gap:8px}
        .mockup-dot{width:12px;height:12px;border-radius:50%;background:#30363d}
        .mockup-dot.r{background:#ff5f56}.mockup-dot.y{background:#ffbd2e}.mockup-dot.g{background:#27c93f}
        .mockup-title{font-family:var(--font-mono);font-size:12px;color:var(--text-dim)}
        .mockup-body{padding:24px;font-family:var(--font-mono);font-size:14px;color:var(--text-dim);overflow-x:auto;line-height:1.7}
        .cursor::after{content:'▋';animation:blink 1s step-end infinite;color:var(--blue)}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        .syntax-keyword{color:#ff7b72;font-weight:600}.syntax-function{color:#d2a8ff}.syntax-string{color:#a5d6ff}.syntax-type{color:#79c0ff}.syntax-comment{color:#8b949e;font-style:italic}
        .metric{display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center}
        .metric-number{font-size:64px;font-family:var(--font-heading);font-weight:700;color:white;line-height:1;text-shadow:0 0 30px rgba(255,255,255,.05)}
        .metric-label{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:var(--bright);font-weight:700}
        .comp-table-wrap{overflow-x:auto;padding:10px;margin:0 -10px}
        .comp-table{width:100%;min-width:800px;border-collapse:separate;border-spacing:0;margin-top:20px}
        .comp-table th,.comp-table td{padding:24px 20px;border-bottom:1px solid var(--border)}
        .comp-table th{font-family:var(--font-heading);font-weight:600;color:white;font-size:20px;letter-spacing:.5px}
        .comp-table th:not(:first-child),.comp-table td:not(:first-child){text-align:center;width:22%}
        .comp-table td{color:var(--text-dim);font-size:16px}
        .comp-table tr td:first-child{font-weight:600;color:white;font-size:17px;width:34%;text-align:left}
        .comp-table tr:last-child td{border-bottom:none}
        .glow-col{background:linear-gradient(180deg,rgba(56,139,253,.1) 0%,rgba(56,139,253,.02) 100%);border-left:2px solid var(--blue);border-right:2px solid var(--blue);position:relative}
        .glow-col-top{border-top:2px solid var(--blue);border-radius:16px 16px 0 0;box-shadow:0 -10px 30px rgba(56,139,253,.2);color:var(--bright)!important;font-size:22px!important}
        .glow-col-bot{border-bottom:2px solid var(--blue);border-radius:0 0 16px 16px;box-shadow:0 10px 30px rgba(56,139,253,.2)}
        .check{color:var(--green);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px}
        .check::before{content:'✓';font-size:18px}
        .cross{color:#484f58;display:inline-flex;align-items:center;justify-content:center;gap:8px}
        .cross::before{content:'✕';font-size:16px}
        .timeline{position:relative;padding-left:40px;border-left:2px solid var(--border);margin-left:20px}
        .timeline-item{position:relative;margin-bottom:50px}
        .timeline-item::before{content:'';position:absolute;left:-47px;top:4px;width:14px;height:14px;background:var(--bg);border:2px solid var(--bright);border-radius:50%}
        .timeline-item.active::before{background:var(--bright);box-shadow:0 0 15px var(--bright)}
        .timeline-date{font-family:var(--font-mono);font-size:13px;color:var(--bright);font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
        .timeline-title{font-size:24px;font-weight:600;color:white;margin-bottom:12px;font-family:var(--font-heading)}
        .timeline-desc{color:var(--text-dim);font-size:16px;line-height:1.6;max-width:800px}
        .arch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:40px}
        .arch-card{padding:32px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:20px}
        .arch-card h4{color:white;font-size:20px;margin-bottom:12px}
        .arch-card p{color:var(--text-dim);font-size:15px;line-height:1.6}
        .footer-cta{text-align:center;padding:120px 0;border-top:1px solid var(--border);margin-top:60px;position:relative}
        .footer-cta::before{content:'';position:absolute;top:-1px;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,var(--blue),transparent)}
        .footer-cta h2{font-size:56px;margin-bottom:24px;letter-spacing:-1.5px}
        .footer-cta p{color:var(--text-dim);margin-bottom:40px;font-size:20px;max-width:700px;margin-left:auto;margin-right:auto;line-height:1.6}
        @media(max-width:960px){.feature-row,.feature-row:nth-child(even){flex-direction:column;gap:40px;margin-bottom:80px}.arch-grid{grid-template-columns:1fr}.col-8,.col-6,.col-4,.col-3{grid-column:span 12}nav{padding:16px 20px}nav.scrolled{padding:12px 20px}.nav-links{display:none}.hero h1{font-size:48px}}
      `}</style>

      <div className="bg-glow"/>
      <div className="bg-glow-right"/>
      <div className="bg-grid"/>

      <nav id="navbar">
        <a href="#" className="logo">
          <div className="logo-orb">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          GlowIDE
        </a>
        <div className="nav-links">
          <a href="#problem">The Problem</a>
          <a href="#platform">Product Suite</a>
          <a href="#architecture">Architecture</a>
          <a href="#business">Business Model</a>
          <a href="#roadmap">Roadmap</a>
        </div>
        <a href="/" className="btn-primary">Launch Workspace</a>
      </nav>

      <main className="container">

        {/* HERO */}
        <section className="hero reveal active">
          <div className="hero-badge"><span className="pulse-dot"/> Arc Testnet Integrated &amp; Live</div>
          <h1 className="gradient-text">One Browser Tab.<br/>Zero Friction.</h1>
          <p>The ultimate AI-native workspace accelerating Web3 development. Write, compile, test, and deploy smart contracts to the Arc network in under 60 seconds.</p>
          <div style={{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap"}}>
            <a href="#problem" className="btn-primary" style={{padding:"16px 36px",fontSize:"16px"}}>Explore the Platform ↓</a>
            <a href="/" className="btn-outline" style={{padding:"16px 36px",fontSize:"16px"}}>Launch Workspace</a>
          </div>
        </section>

        {/* THE PROBLEM */}
        <section id="problem">
          <div className="bento-grid">
            <div className="bento-card col-12 reveal">
              <div style={{maxWidth:"850px",margin:"0 auto",textAlign:"center"}}>
                <span className="feature-label" style={{color:"var(--red)"}}>The Status Quo</span>
                <h2 className="gradient-text" style={{fontSize:"48px",marginBottom:"24px"}}>Web3 Development is Broken.</h2>
                <p style={{fontSize:"18px",marginBottom:"50px"}}>To deploy a single smart contract today, a developer has to juggle local IDEs, fragile Node.js environments, complex compiler configurations, browser wallet extensions, and testnet faucets. The constant context switching between documentation, AI chatbots, and terminals destroys productivity. It is the single biggest bottleneck preventing millions of Web2 developers from transitioning to Web3.</p>
              </div>
              <div className="mockup-window" style={{borderColor:"rgba(248,81,73,.3)",background:"rgba(248,81,73,.02)",maxWidth:"800px",margin:"0 auto"}}>
                <div className="mockup-header">
                  <div className="mockup-header-left"><div className="mockup-dot r"/><div className="mockup-dot y"/><div className="mockup-dot g"/></div>
                  <span className="mockup-title">Terminal — Local Environment</span>
                  <div style={{width:"40px"}}/>
                </div>
                <div className="mockup-body" style={{color:"var(--text)"}}>
                  $ npx hardhat compile<br/>
                  <span style={{color:"var(--red)"}}>Error HH8: There&apos;s one or more errors in your config file. Missing solc dependencies.</span><br/><br/>
                  $ npm install<br/>
                  <span style={{color:"var(--gold)"}}>WARN ERESOLVE overriding peer dependency...</span><br/><br/>
                  $ npx hardhat run scripts/deploy.js --network arc_testnet<br/>
                  <span style={{color:"var(--red)"}}>ProviderError: Invalid RPC URL or insufficient funds for gas.</span><br/>
                  <span style={{color:"var(--text-dim)"}}>Failed to connect to MetaMask. Attempting reconnect... <span className="cursor"/></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM */}
        <section id="platform">
          <div className="section-header reveal">
            <span className="feature-label">The Glow Solution</span>
            <h2 className="gradient-text">The Complete Product Suite</h2>
            <p>We&apos;ve abstracted away the infrastructure so developers can focus purely on logic. Everything a builder needs, natively integrated into one premium, zero-config environment.</p>
          </div>

          {/* AI Chat */}
          <div className="feature-row reveal">
            <div className="feature-text">
              <span className="feature-label">Intelligence</span>
              <h3>Context-Aware AI Assistant</h3>
              <p>GlowIDE isn&apos;t just an LLM wrapper. It&apos;s a senior Web3 pair programmer embedded directly into your workspace, inherently aware of the Arc ecosystem&apos;s unique architecture.</p>
              <ul className="feature-list">
                <li><strong>Arc-Optimized:</strong> Pre-trained on Arc documentation, USDC gas token mechanics, and Chain ID configurations.</li>
                <li><strong>Security First:</strong> Automatically audits your Solidity code for reentrancy, overflow, and access control vulnerabilities before deployment.</li>
                <li><strong>Seamless Handoff:</strong> Generates complex contract architectures and injects them directly into your Coder Studio with a single click.</li>
              </ul>
            </div>
            <div className="feature-visual">
              <div className="mockup-window">
                <div className="mockup-header"><div className="mockup-header-left"><div className="mockup-dot"/><div className="mockup-dot"/><div className="mockup-dot"/></div><span className="mockup-title">GlowIDE AI</span><div style={{width:"40px"}}/></div>
                <div className="mockup-body">
                  <span style={{color:"var(--blue)"}}>You:</span> Write an Arc Testnet ERC-20 token that charges a 1% USDC fee on transfer.<br/><br/>
                  <span style={{color:"var(--green)"}}>GlowIDE AI:</span> I&apos;ve drafted <code>FeeToken.sol</code>. It utilizes Arc&apos;s native USDC (0x3600...) for the fee mechanism. I&apos;ve also added a reentrancy guard to the transfer override for safety.<br/><br/>
                  <div style={{display:"inline-block",marginTop:"10px",background:"rgba(56,139,253,.1)",border:"1px solid rgba(56,139,253,.3)",padding:"6px 12px",borderRadius:"6px",color:"var(--bright)",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}}>📋 Load Code into Editor</div>
                </div>
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="feature-row reveal delay-1">
            <div className="feature-visual">
              <div className="mockup-window">
                <div className="mockup-header"><div className="mockup-header-left"><div className="mockup-dot"/><div className="mockup-dot"/><div className="mockup-dot"/></div><span className="mockup-title">Workspace.sol</span><div style={{width:"40px"}}/></div>
                <div className="mockup-body">
                  <span className="syntax-keyword">pragma</span> <span className="syntax-type">solidity</span> ^0.8.20;<br/><br/>
                  <span className="syntax-comment">/**</span><br/>
                  <span className="syntax-comment">&nbsp;*&nbsp;@dev Arc Testnet Native Subscription</span><br/>
                  <span className="syntax-comment"> */</span><br/>
                  <span className="syntax-keyword">contract</span> <span className="syntax-function">GlowSub</span> {"{"}{"}"}<br/>
                  &nbsp;&nbsp;<span className="syntax-type">address</span> <span className="syntax-keyword">public</span> owner;<br/>
                  &nbsp;&nbsp;<span className="syntax-keyword">function</span> <span className="syntax-function">pay</span>() <span className="syntax-keyword">external</span> {"{"}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syntax-comment">&#47;&#47; Logic executes here</span><span className="cursor"/><br/>
                  &nbsp;&nbsp;{"}"}<br/>
                  {"}"}
                </div>
              </div>
            </div>
            <div className="feature-text">
              <span className="feature-label" style={{color:"var(--gold)"}}>Development</span>
              <h3>The Arc Workstation</h3>
              <p>A desktop-grade IDE experience running entirely in the browser. Write code with zero latency and compile to EVM bytecode instantly — 10 production-ready Arc templates included.</p>
              <ul className="feature-list">
                <li><strong>Cloud Compiler:</strong> Process <code>solc</code> compilations via our backend ensuring fast ABI generation.</li>
                <li><strong>10 Arc Templates:</strong> ERC-20+CCTP, NFT, Staking, DAO, Bridge, Multisig, Payroll, USYC Vault and more.</li>
                <li><strong>VS Code Icons:</strong> Real-time syntax highlighting, auto-formatting, and intelligent autocompletion for Solidity.</li>
              </ul>
            </div>
          </div>

          {/* Deploy */}
          <div className="feature-row reveal delay-1">
            <div className="feature-text">
              <span className="feature-label" style={{color:"var(--green)"}}>Infrastructure</span>
              <h3>1-Click Arc Launchpad</h3>
              <p>We&apos;ve eliminated the friction between writing code and putting it on-chain. The Launchpad bridges your workspace directly to the Arc network.</p>
              <ul className="feature-list">
                <li><strong>Wallet Sync:</strong> Seamless MetaMask integration. Switch to Arc Testnet with one click.</li>
                <li><strong>Dynamic ABI:</strong> Auto-parses your ABI and generates clean input UI for constructor arguments.</li>
                <li><strong>USDC Gas Engine:</strong> Instantly calculates deployment costs in native USDC leveraging Arc&apos;s stablecoin gas model.</li>
              </ul>
            </div>
            <div className="feature-visual">
              <div className="mockup-window" style={{borderColor:"rgba(34,197,94,.3)"}}>
                <div className="mockup-header"><div className="mockup-header-left"><div className="mockup-dot"/><div className="mockup-dot"/><div className="mockup-dot"/></div><span className="mockup-title">Deployment Engine</span><div style={{width:"40px"}}/></div>
                <div className="mockup-body">
                  <span style={{color:"var(--text-dim)",fontSize:"11px",textTransform:"uppercase"}}>Constructor Arguments</span><br/>
                  <div style={{background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",padding:"8px 12px",borderRadius:"6px",margin:"8px 0 16px"}}>Name (string): GlowToken</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{color:"var(--text-dim)"}}>Est. Gas Limit:</span><span>2,401,050</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"24px"}}><span style={{color:"var(--text-dim)"}}>Est. USDC Cost:</span><span style={{color:"var(--green)",fontWeight:"bold"}}>~0.001 USDC</span></div>
                  <div style={{background:"linear-gradient(135deg,#15803d,var(--green))",color:"#fff",textAlign:"center",padding:"10px",borderRadius:"8px",fontWeight:"bold",cursor:"pointer"}}>Deploy to Arc Testnet</div>
                </div>
              </div>
            </div>
          </div>

          {/* Explorer */}
          <div className="feature-row reveal delay-1">
            <div className="feature-visual">
              <div className="mockup-window" style={{borderColor:"rgba(168,85,247,.3)"}}>
                <div className="mockup-header"><div className="mockup-header-left"><div className="mockup-dot"/><div className="mockup-dot"/><div className="mockup-dot"/></div><span className="mockup-title">On-Chain Interaction</span><div style={{width:"40px"}}/></div>
                <div className="mockup-body">
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px"}}><span style={{background:"rgba(168,85,247,.2)",color:"var(--purple)",padding:"2px 8px",borderRadius:"4px",fontSize:"10px",fontWeight:"bold"}}>READ</span><span style={{fontWeight:"bold",color:"white"}}>balanceOf</span></div>
                  <div style={{background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",padding:"8px 12px",borderRadius:"6px",marginBottom:"12px",color:"var(--text-dim)"}}>0x4CF...</div>
                  <div style={{background:"rgba(255,255,255,.1)",color:"#fff",textAlign:"center",padding:"8px",borderRadius:"6px",fontWeight:"bold",marginBottom:"16px"}}>Call Function</div>
                  <div style={{background:"rgba(0,0,0,.5)",border:"1px solid rgba(168,85,247,.3)",padding:"10px",borderRadius:"6px",color:"var(--green)",fontFamily:"var(--font-mono)",fontSize:"12px"}}>Result: 1,000,000,000</div>
                </div>
              </div>
            </div>
            <div className="feature-text">
              <span className="feature-label" style={{color:"var(--purple)"}}>Testing</span>
              <h3>Integrated Data Explorer</h3>
              <p>The moment a contract is deployed, GlowIDE auto-generates a complete GUI to test it. Real-time charts powered by CoinGecko &amp; DexScreener for all 35 EVM networks.</p>
              <ul className="feature-list">
                <li><strong>Instant Interaction:</strong> Read state variables and execute write transactions directly from the IDE.</li>
                <li><strong>Real-Time Charts:</strong> TradingView candlestick &amp; line charts for every token, across all networks.</li>
                <li><strong>Multi-Wallet:</strong> Track balances, send, receive, and bridge USDC via CCTP cross-chain.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section id="architecture">
          <div className="section-header reveal">
            <span className="feature-label">Under the Hood</span>
            <h2 className="gradient-text">Enterprise-Grade Architecture</h2>
            <p>GlowIDE isn&apos;t just a frontend wrapper. It&apos;s a secure, scalable platform built for high-availability Web3 execution.</p>
          </div>
          <div className="arch-grid">
            <div className="arch-card reveal">
              <div className="bento-icon" style={{width:"40px",height:"40px",marginBottom:"16px"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h4>Non-Custodial Security</h4>
              <p>We never hold user private keys. All transaction signing happens client-side via MetaMask. Our backend only facilitates compilation and RPC read-proxying.</p>
            </div>
            <div className="arch-card reveal delay-1">
              <div className="bento-icon" style={{width:"40px",height:"40px",marginBottom:"16px",color:"var(--gold)",background:"rgba(226,183,20,.1)",borderColor:"rgba(226,183,20,.3)"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div>
              <h4>AI Training Pipeline</h4>
              <p>Custom system prompts and few-shot training examples stored in Supabase. Every AI response is tuned specifically for Arc Testnet, Circle CCTP, and USDC gas mechanics.</p>
            </div>
            <div className="arch-card reveal delay-2">
              <div className="bento-icon" style={{width:"40px",height:"40px",marginBottom:"16px",color:"var(--green)",background:"rgba(34,197,94,.1)",borderColor:"rgba(34,197,94,.3)"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
              <h4>Circle Native Integration</h4>
              <p>Built on Circle&apos;s full product suite — USDC, EURC, cirBTC, USYC, CCTP V2, Embedded Wallets, and Gateway unified balance. First-class citizen of the Arc ecosystem.</p>
            </div>
          </div>
        </section>

        {/* MARKET */}
        <section id="market">
          <div className="section-header reveal">
            <h2 className="gradient-text">The Market Opportunity</h2>
            <p>We are expanding the TAM by lowering the Web3 barrier to entry to zero.</p>
          </div>
          <div className="bento-grid">
            {[
              {num:"30M+",label:"Total Addressable Market",desc:"Global software developers. We provide the frictionless bridge for traditional Web2 engineers to enter the Web3 ecosystem.",color:"white"},
              {num:"500k",label:"Serviceable Addressable Market",desc:"Active monthly Web3 developers looking to escape fragmented tooling and consolidate their workflow.",color:"var(--bright)"},
              {num:"Arc",label:"Serviceable Obtainable Market",desc:"Capturing the rapidly growing Arc ecosystem by positioning GlowIDE as the undisputed, officially recommended IDE.",color:"var(--green)"},
            ].map((m) => (
              <div key={m.label} className="bento-card col-4 reveal">
                <div className="metric">
                  <div className="metric-number" style={{color:m.color}}>{m.num}</div>
                  <div className="metric-label" style={{color:"var(--text-dim)"}}>{m.label}</div>
                  <p style={{fontSize:"15px",marginTop:"12px",color:"var(--text-dim)"}}>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPETITIVE MOAT */}
        <section id="moat">
          <div className="section-header reveal">
            <span className="feature-label">Strategic Advantage</span>
            <h2 className="gradient-text">The Competitive Moat</h2>
            <p>GlowIDE isn&apos;t just a tool — it&apos;s a structural advantage. We&apos;ve built a defensive moat around the developer experience that legacy stacks cannot easily replicate.</p>
          </div>
          <div className="bento-grid">
            <div className="bento-card col-12 reveal" style={{padding:"0",overflow:"visible",background:"transparent",border:"none"}}>
              <div className="comp-table-wrap">
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th style={{textAlign:"left",background:"transparent"}}>Value Prop</th>
                      <th>VS Code + Hardhat</th>
                      <th>Remix IDE</th>
                      <th className="glow-col glow-col-top"><div style={{fontSize:"12px",textTransform:"uppercase",letterSpacing:"2px",marginBottom:"8px",color:"var(--blue)"}}>Generational Leap</div>GlowIDE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Onboarding Velocity","Hours (Local Configs)","Minutes (No Context)","Instant (Browser Native)"],
                      ["AI Synergy","Generic plugins only","Basic auto-complete","Native senior-pair logic"],
                      ["Arc Integration","Manual RPC/Chain setup","Fragmented setup","1-Click Testnet Native"],
                      ["Gas Economics","Manual USDC bridging","Complex calculations","Automated USDC Gas Engine"],
                      ["Circle CCTP","Not supported","Not supported","Full V2 Bridge + 35 Networks"],
                      ["Real-Time Charts","Not integrated","Not integrated","CoinGecko + DexScreener"],
                    ].map(([feat,vsc,remix,glow],i) => (
                      <tr key={feat}>
                        <td><strong>{feat}</strong></td>
                        <td><span className="cross">{vsc}</span></td>
                        <td><span className="cross">{remix}</span></td>
                        <td className={`glow-col${i===5?" glow-col-bot":""}`}><span className="check">{glow}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="arch-grid" style={{marginTop:"60px"}}>
                {[
                  {title:"Vertical Integration",color:"var(--bright)",desc:"By controlling the Editor, the Compiler, and the Deployment engine, we eliminate the \u2018Context-Switching Tax\u2019 that costs developers 40% of their daily productivity."},
                  {title:"Ecosystem Lock-in",color:"var(--green)",desc:"10 pre-built Arc project templates + AI trained specifically on Circle documentation creates a financial incentive for developers to remain within our ecosystem."},
                  {title:"Data Moat",color:"var(--purple)",desc:"Every interaction trains our AI on the nuances of Arc and the Circle stack, creating specialized intelligence that generic IDEs powered by base models can't match."},
                ].map(m => (
                  <div key={m.title} className="arch-card">
                    <h4 style={{color:m.color}}>{m.title}</h4>
                    <p>{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BUSINESS MODEL */}
        <section id="business">
          <div className="bento-grid">
            <div className="bento-card col-12 reveal" style={{padding:"80px 40px",textAlign:"center"}}>
              <h2 className="gradient-text" style={{fontSize:"42px",marginBottom:"16px"}}>Business Model: The Growth Flywheel</h2>
              <p style={{fontSize:"18px",color:"var(--text-dim)",maxWidth:"800px",margin:"0 auto 60px"}}>A self-sustaining ecosystem with a clear path to monetization, deep user retention, and enterprise scalability.</p>
              <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:"40px"}}>
                {[
                  {icon:"💳",title:"Web3 SaaS (USDC)",desc:"Frictionless premium tier upgrades directly via smart contracts using Arc's native USDC. Developers pay for advanced AI models and higher compute limits without fiat gateways."},
                  {icon:"⭐",title:"Tokenized Retention",desc:"Developers earn GLOW tokens for writing code and successfully deploying contracts. This gamifies development, creating a highly sticky user base and massive network effects.",color:"var(--gold)"},
                  {icon:"🤝",title:"B2B / Protocol Deals",desc:"White-labeling the GlowIDE environment for other L1/L2 protocols. We charge B2B licensing fees to drastically improve their own developer onboarding metrics.",color:"var(--green)"},
                ].map(m => (
                  <div key={m.title} className="metric" style={{maxWidth:"280px"}}>
                    <div style={{fontSize:"40px",marginBottom:"16px"}}>{m.icon}</div>
                    <h3 style={{fontSize:"22px",color:"white",marginBottom:"8px"}}>{m.title}</h3>
                    <p style={{color:"var(--text-dim)",fontSize:"15px",lineHeight:"1.6"}}>{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap">
          <div className="section-header reveal">
            <h2 className="gradient-text">Product Roadmap</h2>
            <p>Our relentless path to dominating the Web3 developer workspace.</p>
          </div>
          <div className="bento-grid">
            <div className="bento-card col-12 reveal">
              <div className="timeline">
                {[
                  {phase:"Phase 1 (Current)",title:"The Foundation",active:true,desc:"Launch of GlowIDE Beta. Deep integration with the Arc Testnet. Implementation of core AI code generation, browser-based Solc compilation, real-time charts (CoinGecko + DexScreener), multi-wallet CCTP bridge, and 1-click USDC-gas deployments."},
                  {phase:"Phase 2",title:"Advanced Testing & Auditing",active:false,desc:"Integration of automated AI security audits (Slither/Mythril equivalents) directly into the chat interface. Local blockchain simulation in-browser for zero-cost testing before pushing transactions to the live Testnet."},
                  {phase:"Phase 3",title:"The App Marketplace",active:false,desc:"Launch of the GlowIDE Templates Marketplace. Top-tier developers can sell complex, pre-audited smart contract architectures to other users directly for USDC, turning GlowIDE into an economic hub for code, not just an editor."},
                  {phase:"Phase 4",title:"Mainnet & Cross-Chain Interoperability",active:false,desc:"Full Arc Mainnet support. Strategic expansion to EVM-compatible Layer 2s, utilizing Circle's CCTP V2 infrastructure to allow developers to deploy cross-chain applications seamlessly from a single, unified interface."},
                ].map(item => (
                  <div key={item.phase} className={`timeline-item${item.active?" active":""}`} style={item.phase==="Phase 4"?{marginBottom:0}:{}}>
                    <div className="timeline-date">{item.phase}</div>
                    <div className="timeline-title">{item.title}</div>
                    <div className="timeline-desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER CTA */}
        <section id="contact" className="reveal">
          <div className="footer-cta">
            <div className="logo-orb" style={{margin:"0 auto 24px",width:"64px",height:"64px"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h2 className="gradient-text">Ready to Build the Future?</h2>
            <p>Join the next generation of Web3 development. Whether you&apos;re an enterprise looking to scale, a developer looking to build, or a protocol looking to partner, GlowIDE is your workspace.</p>
            <div style={{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap"}}>
              <a href="/" className="btn-primary" style={{padding:"16px 36px",fontSize:"16px"}}>
                Launch Workspace <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{display:"inline"}}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </a>
              <a href="mailto:glowcoderai@gmail.com" className="btn-outline" style={{padding:"16px 36px",fontSize:"16px"}}>Contact Partnerships</a>
            </div>
            <div style={{marginTop:"80px",fontSize:"13px",color:"var(--text-dim)",fontWeight:"500",letterSpacing:"1.5px",textTransform:"uppercase"}}>© 2026 GLOW IDE &nbsp;|&nbsp; BUILDING ON ARC</div>
          </div>
        </section>

      </main>
    </>
  );
}
