import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeishuTokenManager } from "../feishuTokenManager";

const FEISHU_TOKEN_URL =
  "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

function mockFetchResponse(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("FeishuTokenManager", () => {
  let manager: FeishuTokenManager;

  beforeEach(() => {
    manager = new FeishuTokenManager({
      appId: "test_app_id",
      appSecret: "test_app_secret",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("应使用 app_id 和 app_secret 获取 tenant_access_token", async () => {
    const fakeFetch = mockFetchResponse({
      code: 0,
      tenant_access_token: "t-abc123",
      expire: 7200,
    });
    vi.stubGlobal("fetch", fakeFetch);

    const token = await manager.getToken();

    expect(token).toBe("t-abc123");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(fakeFetch).toHaveBeenCalledWith(FEISHU_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: "test_app_id",
        app_secret: "test_app_secret",
      }),
    });
  });

  it("应在有效期内复用缓存的 token（只调用 fetch 一次）", async () => {
    const fakeFetch = mockFetchResponse({
      code: 0,
      tenant_access_token: "t-cached",
      expire: 7200,
    });
    vi.stubGlobal("fetch", fakeFetch);

    const token1 = await manager.getToken();
    const token2 = await manager.getToken();

    expect(token1).toBe("t-cached");
    expect(token2).toBe("t-cached");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("token 过期后应重新获取", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const fakeFetch = mockFetchResponse({
      code: 0,
      tenant_access_token: "t-first",
      expire: 7200,
    });
    vi.stubGlobal("fetch", fakeFetch);

    const token1 = await manager.getToken();
    expect(token1).toBe("t-first");
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    // 模拟 expire=7200 秒，提前 5 分钟过期，所以有效期为 7200 - 300 = 6900 秒
    // 将时间推进 6900 秒，使 token 刚好过期
    vi.advanceTimersByTime(6900 * 1000);

    // 第二次获取时 fetch 应返回新 token
    fakeFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 0,
          tenant_access_token: "t-second",
          expire: 7200,
        }),
    });

    const token2 = await manager.getToken();
    expect(token2).toBe("t-second");
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it("飞书 API 返回错误时应抛出异常", async () => {
    const fakeFetch = mockFetchResponse({
      code: 10001,
      msg: "invalid app_id",
    });
    vi.stubGlobal("fetch", fakeFetch);

    await expect(manager.getToken()).rejects.toThrow(
      "获取飞书 tenant_access_token 失败: invalid app_id"
    );
  });
});
