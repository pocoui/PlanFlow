import type { NextAuthConfig } from "next-auth";

/**
 * Auth.js（next-auth v5）边缘安全配置（middleware 专用视图）。
 *
 * 本文件被 Edge 端（middleware）引用，必须保持 edge-safe：
 * - **不含** Credentials provider —— authorize 逻辑（含 userStore / Prisma / node:crypto）
 *   仅在 lib/auth.ts 的服务器端实例中声明。若在此声明，webpack 会把动态 import 的
 *   userStore（依赖 node:crypto）内联进 middleware bundle，导致 Edge 构建失败。
 * - jwt/session callbacks 保留：服务器端签发会话时持久化 user.id；middleware 解码时
 *   保持一致的 session 形状（jwt callback 在非签发路径为 no-op）。
 *
 * AUTH_SECRET：复用现有 JWT_SECRET 的值（写入 .env）。fail-closed——
 * 缺失时 NextAuth 在启动/构建期即报错，不静默回退读取 JWT_SECRET。
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },
  providers: [], // middleware 不需要 providers；服务器端实例在 auth.ts 补全
  callbacks: {
    async jwt({ token, user }) {
      // 首次签发会话时把 userId 持久化进 token.sub
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // 会话映射：token.sub → session.user.id
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
