import { cn } from "@/lib/utils";
interface CardProps { children: React.ReactNode; className?: string; glow?: boolean; onClick?: () => void; }
export function Card({ children, className, glow, onClick }: CardProps) {
  return (
    <div onClick={onClick} className={cn("bg-glow-card border border-glow-border rounded-xl p-4 transition-all", glow && "hover:border-glow-accent/40 hover:shadow-glow-sm", onClick && "cursor-pointer", className)}>
      {children}
    </div>
  );
}
