import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        glow: {
          bg: "#08080f",
          surface: "#10101c",
          card: "#16162a",
          border: "#252540",
          accent: "#7c3aed",
          "accent-light": "#9f67ff",
          "accent-dim": "#4a1d96",
          cyan: "#06b6d4",
          "cyan-dim": "#0e7490",
          green: "#10b981",
          red: "#ef4444",
          orange: "#f59e0b",
          text: "#e2e8f0",
          muted: "#64748b",
          subtle: "#334155",
        },
      },
      backgroundImage: {
        "glow-gradient": "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
        "glow-gradient-dim": "linear-gradient(135deg, #4a1d96 0%, #0e7490 100%)",
        "hero-gradient": "radial-gradient(ellipse at top, #1e1040 0%, #08080f 60%)",
        "card-gradient": "linear-gradient(145deg, #16162a 0%, #10101c 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #12122a 0%, #0a0a18 100%)",
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(124, 58, 237, 0.3)",
        "glow-md": "0 0 20px rgba(124, 58, 237, 0.4)",
        "glow-lg": "0 0 40px rgba(124, 58, 237, 0.5)",
        "glow-cyan": "0 0 20px rgba(6, 182, 212, 0.4)",
        "card-shadow": "0 4px 24px rgba(0,0,0,0.4)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
