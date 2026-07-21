"use client";

/**
 * GlowIDE animated logo — uses the real logo uploaded in Admin → Website.
 * Falls back to an SVG mark only if nothing has been uploaded yet.
 *
 * Colors:
 *   dark theme  → white (logo as-is)
 *   light theme → dark purple via CSS filter (.glow-logo-img class)
 */

import React, { useState, useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// ── Context-aware phrase banks ────────────────────────────────────────────────
const PHRASES = {
  general:     ["Thinking",      "Processing",   "Considering",   "Reviewing",       "Reasoning",    "Reflecting"],
  code:        ["Writing code",  "Crafting contract", "Building function", "Generating Solidity", "Designing logic", "Implementing"],
  transaction: ["Preparing tx",  "Checking wallet",   "Validating details", "Building calldata",  "Verifying params", "Signing"],
};

export type ThinkingContext = keyof typeof PHRASES;

// ── Helpers ───────────────────────────────────────────────────────────────────
function FallbackMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
      <circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <ellipse cx="50" cy="50" rx="36" ry="10" stroke="currentColor" strokeWidth="0.8" opacity="0.3" transform="rotate(-35 50 50)"/>
      <path
        d="M50 34 C49.4 40 48.5 45 44 50 C48.5 55 49.4 60 50 66 C50.6 60 51.5 55 56 50 C51.5 45 50.6 40 50 34Z
           M34 50 C40 49.4 45 48.5 50 44 C55 48.5 60 49.4 66 50 C60 50.6 55 51.5 50 56 C45 51.5 40 50.6 34 50Z"
        fill="currentColor" opacity="0.95"
      />
    </svg>
  );
}

function LogoImg({ src, size, className }: { src: string; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src} alt="" width={size} height={size}
      className={`object-contain glow-logo-img${className ? " " + className : ""}`}
      style={{ width: size, height: size }}
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── GlowLogo ─────────────────────────────────────────────────────────────────
interface GlowLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
  logoUrl?: string;
}

export function GlowLogo({ size = 32, animate = false, className = "", logoUrl }: GlowLogoProps) {
  const settings = useSiteSettings();
  const src = logoUrl || settings.logoUrl;
  const animClass = animate ? "logo-anim-breathe logo-anim-glow" : "";

  if (src) return <LogoImg src={src} size={size} className={`${animClass} ${className}`}/>;
  return (
    <span className={`${animClass} ${className}`} style={{ display: "inline-flex", width: size, height: size }}>
      <FallbackMark size={size}/>
    </span>
  );
}

// ── GlowLogoThinking ─────────────────────────────────────────────────────────
/**
 * The AI "thinking" animation — animated logo + context-aware phrases with
 * animated dots. Phrases stay on screen for ~4 seconds each (not 2), and the
 * dots animate independently at 400ms so they feel alive without being distracting.
 */
interface ThinkingProps {
  context?: ThinkingContext;
}

export function GlowLogoThinking({ context = "general" }: ThinkingProps) {
  const settings  = useSiteSettings();
  const logoSrc   = settings.logoUrl;
  const phrases   = PHRASES[context] ?? PHRASES.general;

  const [phraseIdx, setPhraseIdx] = useState(0);
  const [fadeIn,    setFadeIn]    = useState(true);
  const [dots,      setDots]      = useState(0); // 0-3, animates independently

  // Dots cycle fast — gives the "loading" feel without being jarring
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 420);
    return () => clearInterval(id);
  }, []);

  // Phrases rotate slowly — stay long enough to read
  useEffect(() => {
    const id = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setPhraseIdx(i => (i + 1) % phrases.length);
        setFadeIn(true);
      }, 320);
    }, 4200); // 4.2 seconds per phrase
    return () => clearInterval(id);
  }, [phrases]);

  // Reset when context changes
  useEffect(() => {
    setPhraseIdx(0);
    setFadeIn(true);
  }, [context]);

  const dotStr = "·".repeat(dots === 0 ? 0 : dots); // · instead of . for style

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      {/* Animated logo with halo */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-glow-accent/20 blur-md animate-pulse"/>
        <div className="relative logo-anim-breathe logo-anim-glow">
          {logoSrc
            ? <LogoImg src={logoSrc} size={26}/>
            : <span className="dark:text-white text-purple-800"><FallbackMark size={26}/></span>}
        </div>
      </div>

      {/* Phrase + animated dots */}
      <div className="flex items-baseline gap-0.5">
        <span
          className="text-sm text-glow-muted/80 transition-opacity duration-300 select-none"
          style={{ opacity: fadeIn ? 1 : 0 }}
        >
          {phrases[phraseIdx]}
        </span>
        <span
          className="text-sm text-glow-accent/70 font-semibold tracking-widest w-5 select-none"
          aria-hidden="true"
        >
          {dotStr}
        </span>
      </div>
    </div>
  );
}

// ── AIMessageAvatar ───────────────────────────────────────────────────────────
export function AIMessageAvatar({ isStreaming }: { isStreaming?: boolean }) {
  const settings = useSiteSettings();
  const logoSrc  = settings.logoUrl;
  const size     = 24;

  return (
    <div className="relative flex-shrink-0 mt-0.5" style={{ width: size, height: size }}>
      {isStreaming && (
        <div className="absolute inset-0 rounded-full bg-glow-accent/25 blur-sm animate-pulse"/>
      )}
      <div className={`relative ${isStreaming ? "logo-anim-breathe" : ""}`}>
        {logoSrc
          ? <LogoImg src={logoSrc} size={size} className={isStreaming ? "" : "opacity-60"}/>
          : <span className={`dark:text-white text-purple-800 ${isStreaming ? "" : "opacity-60"}`}>
              <FallbackMark size={size}/>
            </span>}
      </div>
    </div>
  );
}
