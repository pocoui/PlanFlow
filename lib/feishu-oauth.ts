/**
 * 飞书 OAuth2 授权工具
 *
 * 实现思路：
 * - 飞书 OAuth2 流程：用户授权 → 回调获取 code → 用 code 换 user_access_token
 * - user_access_token 代表用户身份，可以在用户个人日历上创建日程
 * - tenant_access_token 代表应用身份，仅能操作应用自己的日历
 * - 换 token 时需要 tenant_access_token 作为 Authorization header
 *
 * 对比 Vue3：类似 Vue3 中使用 Pinia 管理认证状态，这里用 cookie 持久化 token
 */

const FEISHU_AUTH_BASE = "https://open.feishu.cn/open-apis/authen/v1";

export interface FeishuUserToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
  expiresAt: number; // 毫秒时间戳
}

/**
 * 构建飞书 OAuth2 授权 URL，用户点击后跳转到飞书登录授权页
 */
export function buildFeishuAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL(`${FEISHU_AUTH_BASE}/authorize`);
  url.searchParams.set("app_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  if (params.state) {
    url.searchParams.set("state", params.state);
  }
  return url.toString();
}

/**
 * 用授权码（code）换取 user_access_token
 * 注意：需要 tenant_access_token 作为 Authorization header
 */
export async function exchangeCodeForUserToken(params: {
  code: string;
  tenantAccessToken: string;
}): Promise<FeishuUserToken> {
  const response = await fetch(
    `${FEISHU_AUTH_BASE}/oidc/access_token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.tenantAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: params.code,
      }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(
      `飞书 OAuth2 换取 user_access_token 失败: [${data.code}] ${data.msg ?? "unknown"}`
    );
  }

  const token = data.data;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    // 提前 5 分钟过期
    expiresAt: Date.now() + (token.expires_in - 300) * 1000,
  };
}

/**
 * 用 refresh_token 刷新 user_access_token
 */
export async function refreshUserToken(params: {
  refreshToken: string;
  tenantAccessToken: string;
}): Promise<FeishuUserToken> {
  const response = await fetch(
    `${FEISHU_AUTH_BASE}/oidc/refresh_access_token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.tenantAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: params.refreshToken,
      }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(
      `飞书 OAuth2 刷新 user_access_token 失败: [${data.code}] ${data.msg ?? "unknown"}`
    );
  }

  const token = data.data;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    expiresAt: Date.now() + (token.expires_in - 300) * 1000,
  };
}

/**
 * 检查 token 是否已过期
 */
export function isTokenExpired(token: FeishuUserToken): boolean {
  return Date.now() >= token.expiresAt;
}

/**
 * 将 FeishuUserToken 序列化为字符串，存入 cookie
 */
export function serializeUserToken(token: FeishuUserToken): string {
  return JSON.stringify(token);
}

/**
 * 从 cookie 反序列化 FeishuUserToken
 */
export function deserializeUserToken(str: string): FeishuUserToken | null {
  try {
    const parsed = JSON.parse(str);
    if (parsed.accessToken && parsed.refreshToken) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresIn: parsed.expiresIn,
        expiresAt: parsed.expiresAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}
