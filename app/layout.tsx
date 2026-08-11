import type { Metadata } from "next";
import "./globals.css";

import { SessionProvider } from "next-auth/react";

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
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
