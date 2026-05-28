"use client";
import { TopBar } from "./TopBar";
import React from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-glow-bg overflow-hidden">
      <TopBar title={title} description={description} />
      <main className="flex-1 overflow-auto min-h-0">{children}</main>
    </div>
  );
}
