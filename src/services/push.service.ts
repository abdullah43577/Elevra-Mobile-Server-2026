const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/*
  Expo's push API is a plain HTTP endpoint, so there is no SDK dependency here.

  Delivery is deliberately best-effort: a dead or stale device token must never
  fail the request that triggered the notification. The Notification row is the
  source of truth; the push is a courtesy on top of it.
*/
export class PushService {
  async send(messages: PushMessage[]) {
    const valid = messages.filter(message => this.isExpoToken(message.to));
    if (valid.length === 0) return { sent: 0 };

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(valid),
      });

      if (!response.ok) {
        console.error("Expo push rejected the request:", response.status, await response.text());
        return { sent: 0 };
      }

      return { sent: valid.length };
    } catch (error) {
      console.error("Expo push request failed:", error);
      return { sent: 0 };
    }
  }

  private isExpoToken(token?: string | null): token is string {
    return !!token && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
  }
}
