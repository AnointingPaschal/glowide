"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeApplier } from "./ThemeApplier";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 2 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      {children}
      <Toaster position="bottom-right" toastOptions={{ style: { background:"var(--toast-bg,#16162a)", color:"var(--toast-text,#e2e8f0)", border:"1px solid var(--toast-border,#252540)", borderRadius:"8px", fontSize:"13px" }, success: { iconTheme:{ primary:"#10b981", secondary:"#16162a" } }, error: { iconTheme:{ primary:"#ef4444", secondary:"#16162a" } } }} />
    </QueryClientProvider>
  );
}
