"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { useThemeStore } from "@/store/themeStore";

function ToasterWrapper() {
  const { theme } = useThemeStore();
  const dark = theme === "dark";
  return (
    <Toaster position="bottom-right" toastOptions={{
      style: {
        background: dark ? "#16162a" : "#ffffff",
        color: dark ? "#e2e8f0" : "#0f172a",
        border: `1px solid ${dark ? "#252540" : "#dde0ee"}`,
        borderRadius: "8px", fontSize: "13px",
      },
      success: { iconTheme: { primary: "#10b981", secondary: dark ? "#16162a" : "#fff" } },
      error:   { iconTheme: { primary: "#ef4444", secondary: dark ? "#16162a" : "#fff" } },
    }} />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60*1000, retry: 2 } },
  }));
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToasterWrapper />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
