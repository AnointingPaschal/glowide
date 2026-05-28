"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#16162a",
            color: "#e2e8f0",
            border: "1px solid #252540",
            borderRadius: "8px",
            fontSize: "13px",
            maxWidth: "360px",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#16162a" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#16162a" },
          },
        }}
      />
    </QueryClientProvider>
  );
}
