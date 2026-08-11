// 认证路由组布局：无侧边栏，独立居中卡片式布局（登录/注册页）。
export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
