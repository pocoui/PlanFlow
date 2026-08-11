import { AppShell } from "@/components/app-shell";

// 主应用路由组布局：所有带侧边栏的页面（首页/计划/任务/设置）经由 AppShell 保持一致导航。
// 认证页（login/register）位于 (auth) 组，不受此布局影响。
export default function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
