// ── VS Code-style file icons as React components ──────────────────────────────
import type { ReactNode } from "react";

interface IconProps { size?: number; className?: string; }

// Language color tokens
const C = {
  sol:  "#627EEA",
  ts:   "#3178C6",
  tsx:  "#61DAFB",
  js:   "#F7DF1E",
  jsx:  "#61DAFB",
  py:   "#3776AB",
  rs:   "#CE422B",
  go:   "#00ADD8",
  json: "#FFCA28",
  html: "#E34C26",
  css:  "#1572B6",
  md:   "#7B5EA7",
  env:  "#ECD53F",
  yaml: "#CB171E",
  sh:   "#89E051",
  toml: "#9C4221",
  default: "#6B7280",
};

function FileIconSVG({ color, letter, size=16 }: { color:string; letter:string; size?:number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="0" width="14" height="16" rx="2" fill={color + "22"}/>
      <rect x="1" y="0" width="14" height="16" rx="2" stroke={color} strokeWidth="1.2" fill="none"/>
      <text x="8" y="11" textAnchor="middle" fontSize="7" fontWeight="700"
        fontFamily="'JetBrains Mono',monospace" fill={color}>{letter.toUpperCase()}</text>
    </svg>
  );
}

const ICONS: Record<string, (p:IconProps) => ReactNode> = {
  sol:  p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#627EEA22"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#627EEA" strokeWidth="1.2" fill="none"/><text x="8" y="10" textAnchor="middle" fontSize="6.5" fontWeight="800" fontFamily="monospace" fill="#627EEA">SOL</text></svg>,
  ts:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#3178C6"/><text x="8" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="monospace" fill="white">TS</text></svg>,
  tsx:  p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#007ACC"/><text x="8" y="11.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fontFamily="monospace" fill="#61DAFB">TSX</text></svg>,
  js:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#F7DF1E"/><text x="8" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fontFamily="monospace" fill="#323330">JS</text></svg>,
  jsx:  p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#20232A"/><text x="8" y="11.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fontFamily="monospace" fill="#61DAFB">JSX</text></svg>,
  json: p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#FFCA2822"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#FFCA28" strokeWidth="1.2" fill="none"/><text x="8" y="10" textAnchor="middle" fontSize="5.5" fontWeight="700" fontFamily="monospace" fill="#FFCA28">JSON</text></svg>,
  html: p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#E34C26"/><text x="8" y="11" textAnchor="middle" fontSize="5.5" fontWeight="800" fontFamily="monospace" fill="white">HTML</text></svg>,
  css:  p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect width="16" height="16" rx="2" fill="#1572B6"/><text x="8" y="11.5" textAnchor="middle" fontSize="7" fontWeight="800" fontFamily="monospace" fill="white">CSS</text></svg>,
  md:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#7B5EA722"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#7B5EA7" strokeWidth="1.2" fill="none"/><text x="8" y="11" textAnchor="middle" fontSize="6" fontWeight="700" fontFamily="monospace" fill="#7B5EA7">MD</text></svg>,
  py:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#3776AB22"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#3776AB" strokeWidth="1.2" fill="none"/><text x="8" y="11.5" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="monospace" fill="#3776AB">PY</text></svg>,
  rs:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#CE422B22"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#CE422B" strokeWidth="1.2" fill="none"/><text x="8" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="#CE422B">RS</text></svg>,
  yaml: p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#CB171E22"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#CB171E" strokeWidth="1.2" fill="none"/><text x="8" y="10" textAnchor="middle" fontSize="5.5" fontWeight="700" fontFamily="monospace" fill="#CB171E">YAML</text></svg>,
  sh:   p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#89E05122"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#89E051" strokeWidth="1.2" fill="none"/><text x="8" y="11.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fontFamily="monospace" fill="#89E051">SH</text></svg>,
  env:  p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#ECD53F22"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#ECD53F" strokeWidth="1.2" fill="none"/><text x="8" y="10" textAnchor="middle" fontSize="5.5" fontWeight="700" fontFamily="monospace" fill="#ECD53F">ENV</text></svg>,
  toml: p => <svg {...p} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width={p.size??16} height={p.size??16}><rect x="1" y="0" width="14" height="16" rx="2" fill="#9C421122"/><rect x="1" y="0" width="14" height="16" rx="2" stroke="#9C4221" strokeWidth="1.2" fill="none"/><text x="8" y="10" textAnchor="middle" fontSize="5" fontWeight="700" fontFamily="monospace" fill="#9C4221">TOML</text></svg>,
};

export function FileIcon({ name, size=16, className="" }: { name:string; size?:number; className?:string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Comp = ICONS[ext];
  if (Comp) return <>{Comp({ size, className })}</>;
  return <FileIconSVG color={C.default} letter={ext.slice(0,2)||"?"} size={size}/>;
}
