import { cn } from "@/lib/utils";
const variants = {
  default: "bg-glow-surface text-glow-muted border border-glow-border",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
  info: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};
export function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: keyof typeof variants; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>{children}</span>;
}
