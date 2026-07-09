const FEISHU_BASE = "https://open.feishu.cn/open-apis";

/**
 * 获取飞书应用主日历的 calendar_id。
 * 需要先通过 FeishuTokenManager 获取 tenant_access_token 再传入。
 */
export async function getFeishuPrimaryCalendarId(
  token: string
): Promise<string> {
  const response = await fetch(
    `${FEISHU_BASE}/calendar/v4/calendars/primary`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(
      `获取飞书主日历失败: [${data.code}] ${data.msg ?? "unknown"}`
    );
  }

  // 飞书 primary calendar API 返回的日历字段直接在 data 下，不嵌套 calendar 对象
  return data.data.calendar_id as string;
}
