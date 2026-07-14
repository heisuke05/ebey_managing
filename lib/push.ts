import webpush from "web-push";
import { listSubscriptions, removeSubscription } from "./sheets";

let configured = false;

function setup(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    pub,
    priv
  );
  configured = true;
  return true;
}

/**
 * 指定ロールの端末へプッシュ通知を送る。
 * roles を省略すると全員に送る。無効になった購読は自動削除。
 */
export async function notify(
  title: string,
  body: string,
  roles?: string[],
  url: string = "/"
): Promise<number> {
  if (!setup()) return 0;
  const subs = await listSubscriptions();
  const targets = roles ? subs.filter((s) => roles.includes(s.role)) : subs;
  let sent = 0;
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url })
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removeSubscription(s.endpoint).catch(() => {});
        }
      }
    })
  );
  return sent;
}
