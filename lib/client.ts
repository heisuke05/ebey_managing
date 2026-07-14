"use client";

import { Role } from "./types";

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem("role") as Role) || null;
}

export function getName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("name") || "";
}

export function saveRole(role: Role, name: string) {
  localStorage.setItem("role", role);
  localStorage.setItem("name", name);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** プッシュ通知の購読を登録する。成功したらtrue */
export async function registerPush(role: string, name: string): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return false;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), role, name }),
    });
    return res.ok;
  } catch (e) {
    console.error("push registration failed:", e);
    return false;
  }
}

/** 写真ファイルをアップロードして公開URLを返す */
export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
  return data.url as string;
}
