import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "PlanFlow AI",
  description: "AI learning plan and calendar scheduling assistant"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
