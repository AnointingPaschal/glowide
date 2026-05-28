"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";
interface ModalProps { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; }
export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  if (!isOpen) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full bg-glow-card border border-glow-border rounded-2xl shadow-card-shadow animate-fade-in", sizes[size])}>
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-glow-border">
            <h3 className="text-base font-semibold text-glow-text">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-lg text-glow-muted hover:text-glow-text hover:bg-glow-surface transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
