import { NextRequest, NextResponse } from "next/server";

import { handleCsrf } from "@/lib/server/csrf";

export function middleware(request: NextRequest) {
  // CSRF 防护
  const csrfResponse = handleCsrf(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有 API 路由
     * Next.js middleware 只在 Node.js runtime 运行，不影响静态资源
     */
    "/api/:path*",
  ],
};
