"use client";

/**
 * GlowIDE animated logo — used as the AI "thinking" avatar.
 * SVG recreation of the uploaded brand mark (concentric rings + 4-point star).
 * 
 * Color:
 *   dark theme  → white (all strokes/fills)
 *   light theme → deep-purple (#5b21b6) via Tailwind class swap
 * 
 * Animated with:
 *   - outer ring slowly orbiting
 *   - inner ring counter-orbiting at a different speed
 *   - central star twinkling
 *   - overall glow pulse
 */

interface GlowLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export function GlowLogo({ size = 32, animate = false, className = "" }: GlowLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animate ? "logo-anim-glow" : ""} ${className}`}
      aria-hidden="true"
    >
      {/* Outermost ring — orbits clockwise */}
      <g className={animate ? "logo-anim-orbit" : ""}>
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.7" opacity="0.2"/>
        {/* Tiny arc detail on outer ring */}
        <path d="M50 4 A46 46 0 0 1 88 26" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
      </g>

      {/* Mid orbital ring — counter-orbits */}
      <g className={animate ? "logo-anim-orbit-rev" : ""}>
        <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="0.8" opacity="0.35"/>
        {/* Arc detail on mid ring */}
        <path d="M50 18 A32 32 0 0 0 20 62" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55"/>
      </g>

      {/* Inner ring — breathes */}
      <g className={animate ? "logo-anim-breathe" : ""}>
        <circle cx="50" cy="50" r="18" stroke="currentColor" strokeWidth="1" opacity="0.55"/>
      </g>

      {/* Diagonal arc (orbital path) */}
      <ellipse
        cx="50" cy="50" rx="38" ry="11"
        stroke="currentColor" strokeWidth="0.7" opacity="0.3"
        transform="rotate(-35 50 50)"
      />

      {/* Central 4-pointed star / sparkle */}
      <g className={animate ? "logo-anim-star" : ""}>
        <path
          d="M50 34
             C49.4 40 48.5 45 44 50
             C48.5 55 49.4 60 50 66
             C50.6 60 51.5 55 56 50
             C51.5 45 50.6 40 50 34Z
             M34 50
             C40 49.4 45 48.5 50 44
             C55 48.5 60 49.4 66 50
             C60 50.6 55 51.5 50 56
             C45 51.5 40 50.6 34 50Z"
          fill="currentColor"
          opacity="0.95"
        />
        {/* Tiny center dot */}
        <circle cx="50" cy="50" r="2.5" fill="currentColor" opacity="0.8"/>
      </g>
    </svg>
  );
}

/** Streaming "thinking" avatar — cycles through status phrases like Claude */
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
  const [phrase, setPhrase] = React.useState(THINKING_PHRASES[0]);
  const [phraseIdx, setPhraseIdx] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPhraseIdx(i => {
          const next = (i + 1) % THINKING_PHRASES.length;
          setPhrase(THINKING_PHRASES[next]);
          setVisible(true);
          return next;
        });
      }, 250);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      {/* Animated logo */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full bg-glow-accent/20 blur-md animate-pulse"/>
        <GlowLogo
          size={28}
          animate
          className="relative dark:text-white text-purple-800"
        />
      </div>
      {/* Rotating phrase */}
      <span
        className="text-sm text-glow-muted transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {phrase}
      </span>
    </div>
  );
}

import React from "react";
