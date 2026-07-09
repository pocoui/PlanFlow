export interface FeishuTokenConfig {
  appId: string;
  appSecret: string;
}

export class FeishuTokenManager {
  private readonly config: FeishuTokenConfig;
  private cachedToken: string | null = null;
  private expiresAt = 0;

  constructor(config: FeishuTokenConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt) {
      return this.cachedToken;
    }

    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(
        `获取飞书 tenant_access_token 失败: ${data.msg ?? `code ${data.code}`}`
      );
    }

    const token: string = data.tenant_access_token;
    this.cachedToken = token;
    // 提前 5 分钟过期，避免边界情况
    this.expiresAt = Date.now() + (data.expire ?? 7200) * 1000 - 5 * 60 * 1000;

    return token;
  }
}
