import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, hint, leftIcon, rightIcon, ...props }, ref) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-glow-text">{label}</label>}
    <div className="relative">
      {leftIcon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-glow-muted">{leftIcon}</div>}
      <input ref={ref} className={cn("w-full bg-glow-surface border border-glow-border rounded-lg px-3 py-2 text-sm text-glow-text placeholder:text-glow-muted transition-colors focus:outline-none focus:border-glow-accent/60 focus:ring-1 focus:ring-glow-accent/30 disabled:opacity-50", leftIcon && "pl-9", rightIcon && "pr-9", error && "border-red-500/50", className)} {...props} />
      {rightIcon && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-glow-muted">{rightIcon}</div>}
    </div>
    {error && <p className="text-xs text-red-400">{error}</p>}
    {hint && !error && <p className="text-xs text-glow-muted">{hint}</p>}
  </div>
));
Input.displayName = "Input";
