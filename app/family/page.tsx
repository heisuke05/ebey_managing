"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Item } from "@/lib/types";
import { getName, uploadPhoto } from "@/lib/client";

export default function FamilyPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setMessage("読み込みに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const todos = items.filter((i) => i.status === "梱包依頼");
  const stock = items.filter((i) => i.status === "在庫" || i.status === "出品中");

  function pickPhoto(itemId: string) {
    setPhotoTarget(itemId);
    fileRef.current?.click();
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !photoTarget) return;
    setBusyId(photoTarget);
    setMessage("");
    try {
      const url = await uploadPhoto(file);
      await fetch(`/api/items/${photoTarget}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, who: getName() }),
      });
      setMessage("✅ しゃしんを ほぞんしました");
      await load();
    } catch {
      setMessage("❌ しゃしんの ほぞんに しっぱいしました");
    } finally {
      setBusyId(null);
      setPhotoTarget(null);
    }
  }

  async function markShipped(item: Item) {
    if (!confirm(`「${item.name}」を はっそうしましたか?`)) return;
    setBusyId(item.id);
    setMessage("");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "発送済み", who: getName() }),
      });
      if (!res.ok) throw new Error();
      setMessage(`✅ 「${item.name}」を はっそうかんりょうに しました`);
      await load();
    } catch {
      setMessage("❌ うまくいきませんでした。もういちど おしてください。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoSelected}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-indigo-700">やること</h1>
        <button
          onClick={load}
          className="rounded-xl bg-slate-200 px-5 py-3 text-xl font-bold"
        >
          🔄 こうしん
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-center text-xl font-bold">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-2xl text-slate-400">よみこみちゅう…</p>
      ) : todos.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-green-50 p-8 text-center">
          <div className="text-6xl">🎉</div>
          <p className="mt-3 text-2xl font-bold text-green-700">
            いまは やることが ありません
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {todos.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-3xl border-4 border-amber-400 bg-white shadow-lg"
            >
              <div className="bg-amber-400 px-4 py-2 text-xl font-bold text-amber-900">
                📦 こんぽう・はっそう おねがいします
              </div>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-56 w-full object-contain bg-slate-50"
                />
              )}
              <div className="p-5">
                <p className="text-2xl font-bold">{item.name}</p>
                {item.location && (
                  <p className="mt-2 rounded-xl bg-sky-50 p-3 text-xl">
                    📍 ばしょ: <span className="font-bold">{item.location}</span>
                  </p>
                )}
                {item.intl && (
                  <p className="mt-2 rounded-xl bg-purple-50 p-3 text-lg text-purple-700">
                    ✈️ かいがい はっそうです。ラベルは オーナーが よういします。
                  </p>
                )}
                <div className="mt-4 grid gap-3">
                  <button
                    onClick={() => pickPhoto(item.id)}
                    disabled={busyId === item.id}
                    className="rounded-2xl bg-sky-600 p-5 text-2xl font-bold text-white disabled:opacity-50"
                  >
                    📷 しゃしんを とる
                  </button>
                  <button
                    onClick={() => markShipped(item)}
                    disabled={busyId === item.id}
                    className="rounded-2xl bg-green-600 p-5 text-2xl font-bold text-white disabled:opacity-50"
                  >
                    ✅ はっそう かんりょう
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-12 text-2xl font-bold text-slate-600">
        ざいこの しょうひん
      </h2>
      <p className="text-lg text-slate-400">
        しゃしんを とりたいときは しょうひんを タップ
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stock.map((item) => (
          <button
            key={item.id}
            onClick={() => pickPhoto(item.id)}
            disabled={busyId === item.id}
            className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-left shadow-sm disabled:opacity-50"
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-28 w-full bg-slate-50 object-contain"
              />
            ) : (
              <div className="flex h-28 w-full items-center justify-center bg-slate-100 text-4xl">
                📷
              </div>
            )}
            <p className="truncate p-3 text-lg font-bold">{item.name}</p>
          </button>
        ))}
      </div>
    </main>
  );
}
