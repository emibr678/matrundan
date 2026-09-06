/**
 * Serveronly utskick av köade notiser.
 *
 * Kön läses och uppdateras med serverrollen. Varje notis levereras till
 * användarens registrerade enheter; enheter som svarar 404/410 tas bort.
 */
import { sendWebPush, type PushSubscriptionKeys, type VapidConfig } from "./push-crypto.server";

const MAX_BATCH = 50;
const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  notification_type: string;
  attempts: number;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
}

function readVapidConfig(): VapidConfig | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export async function dispatchNotificationOutbox(): Promise<DispatchSummary> {
  const summary: DispatchSummary = { processed: 0, sent: 0, failed: 0, removedSubscriptions: 0 };

  const vapid = readVapidConfig();
  if (!vapid) {
    console.error("Push är inte konfigurerat: VAPID-nycklar saknas i servermiljön.");
    return summary;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin;

  const { data: pending, error } = await admin
    .from("notification_outbox")
    .select("id, user_id, title, body, url, notification_type, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    console.error("Kunde inte läsa notiskön:", error.message);
    return summary;
  }

  const rows = (pending ?? []) as OutboxRow[];
  if (rows.length === 0) return summary;

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: subscriptionRows } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const byUser = new Map<string, SubscriptionRow[]>();
  for (const row of (subscriptionRows ?? []) as (SubscriptionRow & { user_id: string })[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    byUser.set(row.user_id, list);
  }

  const staleSubscriptionIds: string[] = [];

  for (const row of rows) {
    summary.processed += 1;
    const subscriptions = byUser.get(row.user_id) ?? [];

    if (subscriptions.length === 0) {
      await admin
        .from("notification_outbox")
        .update({ status: "skipped", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const payload = JSON.stringify({
      title: row.title,
      body: row.body,
      url: row.url,
      tag: row.notification_type,
    });

    let delivered = 0;
    let lastError = "";

    for (const subscription of subscriptions) {
      const target: PushSubscriptionKeys = {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      };
      try {
        const result = await sendWebPush(target, payload, vapid);
        if (result.gone) {
          staleSubscriptionIds.push(subscription.id);
          lastError = result.error ?? "Enheten är avregistrerad";
        } else if (result.error) {
          lastError = result.error;
        } else {
          delivered += 1;
        }
      } catch (sendError) {
        lastError = sendError instanceof Error ? sendError.message : "Okänt fel vid utskick";
      }
    }

    const attempts = row.attempts + 1;
    if (delivered > 0) {
      summary.sent += 1;
      await admin
        .from("notification_outbox")
        .update({ status: "sent", attempts, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
    } else {
      summary.failed += 1;
      await admin
        .from("notification_outbox")
        .update({
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: lastError.slice(0, 300) || "Ingen enhet kunde nås",
        })
        .eq("id", row.id);
    }
  }

  if (staleSubscriptionIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
    summary.removedSubscriptions = staleSubscriptionIds.length;
  }

  return summary;
}
