import type { CalendarProvider } from "./calendarProvider";
import { MockFeishuCalendarProvider } from "./mockFeishuCalendarProvider";
import { FeishuCalendarProvider } from "./feishuCalendarProvider";
import { FeishuTokenManager } from "./feishuTokenManager";
import { getFeishuPrimaryCalendarId } from "./feishuCalendarId";
import {
  deserializeUserToken,
  isTokenExpired,
  refreshUserToken,
  type FeishuUserToken,
} from "@/lib/feishu-oauth";

export interface CreateCalendarProviderOptions {
  /** 飞书用户 token（从 cookie 解析得到），有此 token 时在用户个人日历操作 */
  userTokenCookie?: string;
}

/**
 * 创建日历 Provider
 *
 * 优先级：
 * 1. 有 user_access_token → 在用户个人日历操作（OAuth2 授权后）
 * 2. 无 user_access_token → 退回应用日历（tenant_access_token）
 * 3. CALENDAR_PROVIDER=mock_feishu → 使用 mock
 */
export function createCalendarProvider(
  options?: CreateCalendarProviderOptions
): CalendarProvider {
  const provider = process.env.CALENDAR_PROVIDER ?? "mock_feishu";

  if (provider === "feishu") {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error(
        "CALENDAR_PROVIDER=feishu 时，必须配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET"
      );
    }

    const tokenManager = new FeishuTokenManager({ appId, appSecret });

    // 尝试使用 user_access_token（OAuth2 授权后可用）
    let userToken: FeishuUserToken | null = null;
    if (options?.userTokenCookie) {
      userToken = deserializeUserToken(options.userTokenCookie);
    }

    // 构造 getToken：优先用 user_access_token，过期则刷新，刷新失败则回退 tenant_access_token
    const getToken = async (): Promise<string> => {
      if (userToken) {
        if (!isTokenExpired(userToken)) {
          return userToken.accessToken;
        }
        // 尝试刷新
        try {
          const tenantToken = await tokenManager.getToken();
          userToken = await refreshUserToken({
            refreshToken: userToken.refreshToken,
            tenantAccessToken: tenantToken,
          });
          return userToken.accessToken;
        } catch {
          // 刷新失败，回退到 tenant_access_token
        }
      }
      return tokenManager.getToken();
    };

    // 缓存日历 ID
    let cachedCalendarId: string | null = null;

    return new FeishuCalendarProvider({
      getToken,
      getCalendarId: async () => {
        if (cachedCalendarId) return cachedCalendarId;
        const token = await getToken();
        cachedCalendarId = await getFeishuPrimaryCalendarId(token);
        return cachedCalendarId;
      },
    });
  }

  // 默认使用 mock
  return new MockFeishuCalendarProvider();
}

/**
 * 判断是否有有效的 user_access_token
 */
export function hasUserAccessToken(cookieStr?: string): boolean {
  if (!cookieStr) return false;
  const token = deserializeUserToken(cookieStr);
  return token !== null;
}
