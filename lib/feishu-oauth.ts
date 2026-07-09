/**
 * 飞书 OAuth2 授权工具
 *
 * 实现思路：
 * - 飞书 OAuth2 浏览器网页流程：用户授权 → 回调获取 code → 用 code 换 user_access_token
 * - 使用 v2/oauth/token 接口（浏览器网页应用专用），通过 client_id + client_secret 换 token
 * - v1/oidc/access_token 是小程序/后台应用用的，不适用浏览器网页场景
 * - user_access_token 代表用户身份，可以在用户个人日历上创建日程
 *
 * 对比 Vue3：类似 Vue3 中使用 Pinia 管理认证状态，这里用 cookie 持久化 token
 */

const FEISHU_AUTH_BASE = "https://open.feishu.cn/open-apis/authen";

export interface FeishuUserToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
  expiresAt: number; // 毫秒时间戳
}

/**
 * 构建飞书 OAuth2 授权 URL，用户点击后跳转到飞书登录授权页
 *
 * scope 参数用于请求用户授权特定权限，空格分隔
 */
export function buildFeishuAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state?: string;
  scope?: string;
}): string {
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  if (params.state) {
    url.searchParams.set("state", params.state);
  }
  if (params.scope) {
    url.searchParams.set("scope", params.scope);
  }
  return url.toString();
}

/**
 * 用授权码（code）换取 user_access_token
 *
 * 使用 v2/oauth/token 接口（浏览器网页应用专用），
 * 通过 client_id + client_secret 认证，而非 tenant_access_token。
 * 此接口能正确处理用户授权的 scope 权限。
 */
export async function exchangeCodeForUserToken(params: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
}): Promise<FeishuUserToken> {
  const response = await fetch(
    `${FEISHU_AUTH_BASE}/v2/oauth/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: params.appId,
        client_secret: params.appSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(
      `飞书 OAuth2 换取 user_access_token 失败: [${data.code}] ${data.msg ?? "unknown"}`
    );
  }

  // v2 接口的 token 字段直接在顶层，不在 data 嵌套下
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    // 提前 5 分钟过期
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
}

/**
 * 用 refresh_token 刷新 user_access_token
 *
 * 使用 v2/oauth/token 接口刷新
 */
export async function refreshUserToken(params: {
  refreshToken: string;
  appId: string;
  appSecret: string;
}): Promise<FeishuUserToken> {
  const response = await fetch(
    `${FEISHU_AUTH_BASE}/v2/oauth/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: params.appId,
        client_secret: params.appSecret,
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

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
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
