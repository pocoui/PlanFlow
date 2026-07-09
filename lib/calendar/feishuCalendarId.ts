const FEISHU_BASE = "https://open.feishu.cn/open-apis";

/**
 * 获取用户的主日历 calendar_id。
 * 使用 user_access_token 时返回用户个人主日历。
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
  console.log("[feishu] primary calendar response:", JSON.stringify(data).substring(0, 300));

  if (data.code !== 0) {
    throw new Error(
      `获取飞书主日历失败: [${data.code}] ${data.msg ?? "unknown"}`
    );
  }

  return data.data.calendar_id as string;
}
