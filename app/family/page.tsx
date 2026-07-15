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
  const [photoTarget, setPhotoTarget] = useState<Item | null>(null);

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

  function pickPhoto(item: Item) {
    setPhotoTarget(item);
    fileRef.current?.click();
  }

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !photoTarget) return;
    const target = photoTarget;
    setBusyId(target.id);
    setMessage("");
    try {
      const url = await uploadPhoto(file);
      const patch = target.imageUrl
        ? { images: [...target.images, url] }
        : { imageUrl: url };
      await fetch(`/api/items/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, who: getName() }),
      });
      setMessage("写真を保存しました");
      await load();
    } catch {
      setMessage("写真の保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusyId(null);
      setPhotoTarget(null);
    }
  }

  async function markShipped(item: Item) {
    if (!confirm(`「${item.name}」を発送しましたか?`)) return;
    setBusyId(item.id);
    setMessage("");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "発送済み", who: getName() }),
      });
      if (!res.ok) throw new Error();
      setMessage(`「${item.name}」を発送完了にしました`);
      await load();
    } catch {
      setMessage("うまくいきませんでした。もう一度押してください。");
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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          やること
        </h1>
        <button
          onClick={load}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base font-medium text-zinc-700 shadow-sm active:scale-[0.97]"
        >
          更新
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-base font-medium text-zinc-800 shadow-sm">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-12 text-center text-lg text-zinc-400">読み込み中…</p>
      ) : todos.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
            ✓
          </div>
          <p className="mt-3 text-lg font-semibold text-zinc-800">
            今はやることがありません
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {todos.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-base font-semibold text-amber-800">
                梱包・発送をお願いします
              </div>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-52 w-full bg-zinc-50 object-contain"
                />
              )}
              <div className="p-5">
                <p className="text-xl font-semibold text-zinc-900">{item.name}</p>
                {item.location && (
                  <p className="mt-2.5 rounded-xl bg-zinc-100 px-4 py-2.5 text-base text-zinc-700">
                    保管場所:{" "}
                    <span className="font-semibold text-zinc-900">
                      {item.location}
                    </span>
                  </p>
                )}
                {item.intl && (
                  <p className="mt-2 rounded-xl bg-violet-50 px-4 py-2.5 text-base text-violet-700">
                    海外発送です。ラベルはオーナーが用意します。
                  </p>
                )}
                <div className="mt-4 grid gap-2.5">
                  <button
                    onClick={() => pickPhoto(item)}
                    disabled={busyId === item.id}
                    className="rounded-xl border border-zinc-300 bg-white py-3.5 text-lg font-semibold text-zinc-800 shadow-sm active:scale-[0.99] disabled:opacity-40"
                  >
                    📷 写真を撮る
                  </button>
                  <button
                    onClick={() => markShipped(item)}
                    disabled={busyId === item.id}
                    className="rounded-xl bg-zinc-900 py-3.5 text-lg font-semibold text-white shadow-lg shadow-zinc-900/15 active:scale-[0.99] disabled:opacity-40"
                  >
                    発送完了にする
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-base font-semibold text-zinc-500">在庫の商品</h2>
      <p className="mt-0.5 text-sm text-zinc-400">
        写真を撮りたい商品をタップしてください
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {stock.map((item) => (
          <button
            key={item.id}
            onClick={() => pickPhoto(item)}
            disabled={busyId === item.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm active:scale-[0.98] disabled:opacity-40"
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-28 w-full bg-zinc-50 object-contain"
              />
            ) : (
              <div className="flex h-28 w-full items-center justify-center bg-zinc-100 text-2xl text-zinc-300">
                📷
              </div>
            )}
            <p className="truncate px-3 py-2.5 text-base font-medium text-zinc-800">
              {item.name}
            </p>
          </button>
        ))}
      </div>
    </main>
  );
}
