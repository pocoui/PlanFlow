import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth.js（next-auth v5）边缘安全配置。
 *
 * 关键约束：本文件同时被 Node 端（/api/auth/[...nextauth]）与 Edge 端（middleware）
 * 引用，因此顶层**不得** import 任何仅 Node 可用的模块（Prisma / node:crypto / 数据库客户端）。
 * authorize 内通过**动态 import** 加载凭据校验模块（userStore），
 * 避免 Prisma 等被 bundle 进 middleware 导致 Edge 运行时错误。
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
  providers: [
    Credentials({
      name: "邮箱密码",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        // 动态 import：userStore 及 Prisma 分支仅随授权请求在 Node 端加载
        const { verifyCredentials } = await import("@/lib/server/userStore");

        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // 校验失败返回 null；数据库不可用抛 UserStoreError（不裸抛堆栈）
        return verifyCredentials(email, password);
      },
    }),
  ],
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
