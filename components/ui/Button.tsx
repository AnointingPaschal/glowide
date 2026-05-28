import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gradient";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => {
    const variants = {
      primary: "bg-glow-accent hover:bg-glow-accent-light text-white border border-glow-accent/30 shadow-glow-sm hover:shadow-glow-md",
      gradient: "bg-glow-gradient text-white hover:opacity-90 shadow-glow-sm hover:shadow-glow-md",
      secondary: "bg-glow-card hover:bg-glow-surface text-glow-text border border-glow-border hover:border-glow-accent/40",
      ghost: "bg-transparent hover:bg-glow-card text-glow-muted hover:text-glow-text",
      danger: "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30",
      outline: "bg-transparent border border-glow-border hover:border-glow-accent/60 text-glow-text hover:bg-glow-card/50",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-xs h-7",
      md: "px-4 py-2 text-sm h-9",
      lg: "px-6 py-2.5 text-base h-11",
      icon: "p-2 h-9 w-9",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow-accent/50",
          variants[variant], sizes[size], className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
