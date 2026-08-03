import webpush from "web-push";

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@anandprime.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys for push notifications");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendTaskReminderPush(
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; url: string }
) {
  const push = configureWebPush();
  await push.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload)
  );
}
