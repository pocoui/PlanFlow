import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildFeishuAuthorizeUrl,
  deserializeUserToken,
  exchangeCodeForUserToken,
  isTokenExpired,
  refreshUserToken,
  serializeUserToken,
} from "../feishu-oauth";

const TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token";
const REFRESH_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token";

function mockFetchResponse(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

describe("feishu-oauth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildFeishuAuthorizeUrl", () => {
    it("应构建正确的授权 URL", () => {
      const url = buildFeishuAuthorizeUrl({
        appId: "cli_test123",
        redirectUri: "http://localhost:3000/api/auth/feishu/callback",
        state: "plan_1",
      });

      expect(url).toContain("app_id=cli_test123");
      expect(url).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Ffeishu%2Fcallback"
      );
      expect(url).toContain("response_type=code");
      expect(url).toContain("state=plan_1");
    });

    it("没有 state 时不附加 state 参数", () => {
      const url = buildFeishuAuthorizeUrl({
        appId: "cli_test",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(url).not.toContain("state=");
    });
  });

  describe("exchangeCodeForUserToken", () => {
    it("应用 code 换取 user_access_token", async () => {
      const fakeFetch = mockFetchResponse({
        code: 0,
        data: {
          access_token: "u-test-token",
          refresh_token: "ur-test-refresh",
          expires_in: 6900,
          token_type: "Bearer",
        },
      });
      vi.stubGlobal("fetch", fakeFetch);

      const result = await exchangeCodeForUserToken({
        code: "auth_code_123",
        tenantAccessToken: "t-tenant-token",
      });

      expect(result.accessToken).toBe("u-test-token");
      expect(result.refreshToken).toBe("ur-test-refresh");
      expect(result.expiresIn).toBe(6900);
      // 提前 5 分钟过期
      expect(result.expiresAt).toBeLessThan(Date.now() + 6900 * 1000);
      expect(result.expiresAt).toBeGreaterThan(Date.now() + 6000 * 1000);

      expect(fakeFetch).toHaveBeenCalledWith(TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer t-tenant-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: "auth_code_123",
        }),
      });
    });

    it("飞书 API 报错时抛出异常", async () => {
      mockFetchResponse({
        code: 10001,
        msg: "invalid code",
      });
      vi.stubGlobal("fetch", mockFetchResponse({
        code: 10001,
        msg: "invalid code",
      }));

      await expect(
        exchangeCodeForUserToken({
          code: "bad_code",
          tenantAccessToken: "t-token",
        })
      ).rejects.toThrow("飞书 OAuth2 换取 user_access_token 失败");
    });
  });

  describe("refreshUserToken", () => {
    it("应用 refresh_token 刷新 token", async () => {
      const fakeFetch = mockFetchResponse({
        code: 0,
        data: {
          access_token: "u-new-token",
          refresh_token: "ur-new-refresh",
          expires_in: 6900,
        },
      });
      vi.stubGlobal("fetch", fakeFetch);

      const result = await refreshUserToken({
        refreshToken: "ur-old-refresh",
        tenantAccessToken: "t-tenant-token",
      });

      expect(result.accessToken).toBe("u-new-token");
      expect(result.refreshToken).toBe("ur-new-refresh");

      expect(fakeFetch).toHaveBeenCalledWith(REFRESH_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer t-tenant-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "ur-old-refresh",
        }),
      });
    });
  });

  describe("isTokenExpired", () => {
    it("过期 token 返回 true", () => {
      const token = {
        accessToken: "x",
        refreshToken: "y",
        expiresIn: 6900,
        expiresAt: Date.now() - 1000, // 已过期
      };
      expect(isTokenExpired(token)).toBe(true);
    });

    it("未过期 token 返回 false", () => {
      const token = {
        accessToken: "x",
        refreshToken: "y",
        expiresIn: 6900,
        expiresAt: Date.now() + 60000, // 还有 1 分钟
      };
      expect(isTokenExpired(token)).toBe(false);
    });
  });

  describe("serializeUserToken / deserializeUserToken", () => {
    it("序列化后反序列化应得到相同数据", () => {
      const token = {
        accessToken: "u-abc",
        refreshToken: "ur-xyz",
        expiresIn: 6900,
        expiresAt: Date.now() + 6000000,
      };

      const str = serializeUserToken(token);
      const parsed = deserializeUserToken(str);

      expect(parsed).toEqual(token);
    });

    it("无效字符串返回 null", () => {
      expect(deserializeUserToken("not-json")).toBeNull();
      expect(deserializeUserToken("{}")).toBeNull();
      expect(deserializeUserToken('{"accessToken":"x"}')).toBeNull();
    });
  });
});
