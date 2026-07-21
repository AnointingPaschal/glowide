"use client";

/**
 * GlowIDE animated logo — uses the real logo uploaded in Admin → Website.
 * Falls back to the SVG mark only if no logo has been uploaded yet.
 *
 * Color:
 *   dark theme  → logo rendered as-is (uploaded logo is white)
 *   light theme → CSS invert + hue-rotate to shift white→dark-purple
 *
 * Animated while AI is generating:
 *   - breathing pulse (scale + opacity)
 *   - soft glow halo
 *   - rotating contextual phrases below
 */

import React, { useState, useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface GlowLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
  logoUrl?: string;
}

// SVG fallback mark — only shown when no admin logo is uploaded
function FallbackMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1" opacity="0.45"/>
      <circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <ellipse cx="50" cy="50" rx="36" ry="10" stroke="currentColor" strokeWidth="0.8" opacity="0.3" transform="rotate(-35 50 50)"/>
      <path d="M50 34 C49.4 40 48.5 45 44 50 C48.5 55 49.4 60 50 66 C50.6 60 51.5 55 56 50 C51.5 45 50.6 40 50 34Z M34 50 C40 49.4 45 48.5 50 44 C55 48.5 60 49.4 66 50 C60 50.6 55 51.5 50 56 C45 51.5 40 50.6 34 50Z"
        fill="currentColor" opacity="0.95"/>
    </svg>
  );
}

export function GlowLogo({ size = 32, animate = false, className = "", logoUrl }: GlowLogoProps) {
  const settings = useSiteSettings();
  const src = logoUrl || settings.logoUrl;

  const animClass = animate ? "logo-anim-breathe logo-anim-glow" : "";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="GlowIDE"
        width={size}
        height={size}
        className={`object-contain ${animClass} ${className}`}
        style={{ width: size, height: size }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  return (
    <span className={`${animClass} ${className}`} style={{ display: "inline-flex", width: size, height: size }}>
      <FallbackMark size={size}/>
    </span>
  );
}

/** Animated AI avatar used as the response "thinking" indicator */
const THINKING_PHRASES = [
  "Thinking…",
  "Writing…",
  "Crafting response…",
  "Analyzing code…",
  "Building…",
  "Reviewing…",
  "Generating…",
  "Almost there…",
];

export function GlowLogoThinking() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const settings = useSiteSettings();
  const logoSrc = settings.logoUrl;

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIdx(i => (i + 1) % THINKING_PHRASES.length);
        setVisible(true);
      }, 250);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      {/* Logo with glow halo */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-glow-accent/20 blur-md animate-pulse"/>
        <div className="relative logo-anim-breathe logo-anim-glow">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              width={26}
              height={26}
              className="object-contain glow-logo-img"
              style={{ width: 26, height: 26 }}
            />
          ) : (
            <FallbackMark size={26}/>
          )}
        </div>
      </div>

      {/* Rotating phrase */}
      <span
        className="text-sm text-glow-muted transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {THINKING_PHRASES[phraseIdx]}
      </span>
    </div>
  );
}

/** Non-animated logo for AI message avatar */
export function AIMessageAvatar({ isStreaming }: { isStreaming?: boolean }) {
  const settings = useSiteSettings();
  const logoSrc = settings.logoUrl;
  const size = 24;

  return (
    <div className="relative flex-shrink-0 mt-0.5" style={{ width: size, height: size }}>
      {isStreaming && (
        <div className="absolute inset-0 rounded-full bg-glow-accent/25 blur-sm animate-pulse"/>
      )}
      <div className={`relative ${isStreaming ? "logo-anim-breathe" : ""}`}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            width={size}
            height={size}
            className={`object-contain glow-logo-img ${isStreaming ? "" : "opacity-60"}`}
            style={{ width: size, height: size }}
          />
        ) : (
          <span className={`dark:text-white text-purple-800 ${isStreaming ? "" : "opacity-60"}`}>
            <FallbackMark size={size}/>
          </span>
        )}
      </div>
    </div>
  );
}
