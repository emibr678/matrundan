/**
 * Klientsidans notishantering: enhetsprenumeration via service worker samt
 * läsning och skrivning av användarens notisinställningar.
 */
import { z } from "zod";

import { rpcClient } from "./rpc-client";
import { getPushPublicKey } from "./notifications.functions";

export const NOTIFICATION_TYPES = [
  "visit_registered",
  "next_stop_changed",
  "added_as_participant",
  "member_joined",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; hint: string }> = {
  visit_registered: {
    title: "Nytt besök registrerat",
    hint: "När någon i gruppen registrerar ett besök.",
  },
  next_stop_changed: {
    title: "Nästa stopp och datum",
    hint: "När gruppen väljer nästa stopp eller föreslår ett datum.",
  },
  added_as_participant: {
    title: "Du var med på besöket",
    hint: "När någon lägger till dig som deltagare på ett besök.",
  },
  member_joined: {
    title: "Ny medlem i gruppen",
    hint: "När någon tackar ja till en inbjudan.",
  },
};

const SW_PATH = "/push-sw.js";

const DEVICE_SCHEMA = z.object({
  id: z.string(),
  endpoint: z.string(),
  device_label: z.string().nullable(),
  created_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
});

const SETTINGS_SCHEMA = z.object({
  preferences: z.record(z.string(), z.boolean()),
  devices: z.array(DEVICE_SCHEMA),
});

export type NotificationDevice = z.infer<typeof DEVICE_SCHEMA>;
export type NotificationSettings = z.infer<typeof SETTINGS_SCHEMA>;

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: "ios-needs-install" | "unsupported" };

export function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs = /Macintosh/.test(ua) && "ontouchend" in document;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "unsupported" };
  const hasApi =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasApi) {
    return { supported: false, reason: isIosLike() ? "ios-needs-install" : "unsupported" };
  }
  if (isIosLike() && !isInstalledApp()) {
    return { supported: false, reason: "ios-needs-install" };
  }
  return { supported: true };
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Enhet";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android-telefon";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows-dator";
  return "Enhet";
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  const registration = existing ?? (await navigator.serviceWorker.register(SW_PATH, { scope: "/" }));
  await navigator.serviceWorker.ready;
  return registration;
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  return rpcClient.call(
    "get_notification_settings",
    {},
    SETTINGS_SCHEMA,
    "Kunde inte hämta dina notisinställningar.",
  );
}

export async function saveNotificationPreference(
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  await rpcClient.callVoid("set_notification_preference", {
    _type: type,
    _enabled: enabled,
  });
}

/** Aktuell prenumerations-endpoint på den här enheten, om någon finns. */
export async function currentDeviceEndpoint(): Promise<string | null> {
  if (checkPushSupport().supported !== true) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export type EnableResult =
  | { status: "enabled"; endpoint: string }
  | { status: "denied" }
  | { status: "unavailable"; message: string };

export async function enablePushOnThisDevice(): Promise<EnableResult> {
  const support = checkPushSupport();
  if (!support.supported) {
    return {
      status: "unavailable",
      message:
        support.reason === "ios-needs-install"
          ? "På iPhone och iPad behöver du först lägga till Matrundan på hemskärmen."
          : "Den här webbläsaren stöder inte notiser.",
    };
  }

  const { publicKey } = await getPushPublicKey();
  if (!publicKey) {
    return { status: "unavailable", message: "Notiser är inte konfigurerade i den här miljön." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const registration = await ensureServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    }));

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh ?? bufferToBase64Url(subscription.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufferToBase64Url(subscription.getKey("auth"));

  await rpcClient.callVoid("register_push_subscription", {
    _endpoint: subscription.endpoint,
    _p256dh: p256dh,
    _auth: auth,
    _device_label: deviceLabel(),
  });

  return { status: "enabled", endpoint: subscription.endpoint };
}

export async function disablePushOnThisDevice(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const settings = await loadNotificationSettings();
  const device = settings.devices.find((item) => item.endpoint === subscription.endpoint);
  if (device) await rpcClient.callVoid("remove_push_subscription", { _id: device.id });
  await subscription.unsubscribe();
}

export async function removeNotificationDevice(id: string): Promise<void> {
  await rpcClient.callVoid("remove_push_subscription", { _id: id });
}
