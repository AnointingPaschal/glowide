"use client";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import React from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-glow-bg overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar title={title} description={description} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
