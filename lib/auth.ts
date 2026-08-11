import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";

/**
 * Auth.js（next-auth v5）服务器端完整实例（Node runtime）。
 *
 * 在边缘安全配置（auth.config.ts）之上补充 Credentials provider：
 * authorize 内**动态 import** userStore —— Prisma 分支仅随授权请求在 Node 端加载，
 * 避免被 bundle 进 middleware（Edge runtime 不支持 node:crypto）。
 *
 * 供 /api/auth/[...nextauth] 处理登录；middleware 使用 auth.config 自建的
 * 轻量实例（无 providers）解码会话，二者共享同一 JWT 结构与 secret。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
});
