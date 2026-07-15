"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Currency, Item, ItemStatus } from "@/lib/types";
import { getName, uploadPhoto } from "@/lib/client";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/items/${id}`);
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    const data = await res.json();
    if (res.ok) setItem(data.item);
    else setMessage(data.error || "読み込みに失敗しました");
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  function set<K extends keyof Item>(key: K, value: Item[K]) {
    setItem((i) => (i ? { ...i, [key]: value } : i));
  }

  async function patch(patchBody: Partial<Item>, successMsg: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patchBody, who: getName() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存に失敗しました");
        return;
      }
      setItem(data.item);
      setMessage(successMsg);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!item) return;
    await patch(
      {
        name: item.name,
        imageUrl: item.imageUrl,
        images: item.images,
        listingUrl: item.listingUrl,
        price: item.price,
        currency: item.currency,
        costJPY: item.costJPY,
        shippingJPY: item.shippingJPY,
        location: item.location,
        tracking: item.tracking,
        intl: item.intl,
        buyerName: item.buyerName,
        buyerAddress: item.buyerAddress,
        buyerCountry: item.buyerCountry,
        contents: item.contents,
        note: item.note,
      },
      "✅ 保存しました"
    );
  }

  async function changeStatus(status: ItemStatus) {
    if (status === "梱包依頼") {
      if (
        !confirm(
          "梱包・発送の依頼を送りますか?\nご家族のスマホに通知が届きます。"
        )
      )
        return;
    }
    await patch(
      { status },
      status === "梱包依頼"
        ? "📣 ご家族に梱包依頼の通知を送りました"
        : `✅ ステータスを「${status}」にしました`
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !item) return;
    setUploading(true);
    try {
      let main = item.imageUrl;
      const extra = [...item.images];
      for (const file of files) {
        const url = await uploadPhoto(file);
        if (!main) main = url;
        else extra.push(url);
      }
      await patch({ imageUrl: main, images: extra }, "✅ 写真を追加しました");
    } catch (err) {
      setMessage(String((err as Error).message ?? err));
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    if (!item) return;
    if (!confirm("この写真を削除しますか?")) return;
    if (item.imageUrl === url) {
      const [next, ...rest] = item.images;
      patch({ imageUrl: next ?? "", images: rest }, "🗑 写真を削除しました");
    } else {
      patch(
        { images: item.images.filter((u) => u !== url) },
        "🗑 写真を削除しました"
      );
    }
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center text-slate-400">
        {message || "読み込み中…"}
      </main>
    );
  }

  const allPhotos = [item.imageUrl, ...item.images].filter(Boolean);
  const input =
    "mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-lg";

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/owner" className="text-2xl">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-indigo-700">
          {item.name}
        </h1>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
          {item.status}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPhoto}
      />

      {/* 写真ギャラリー */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {allPhotos.map((url, i) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${item.name} ${i + 1}`}
              className="h-28 w-full rounded-xl bg-slate-50 object-contain"
            />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-indigo-600 px-1.5 py-0.5 text-xs font-bold text-white">
                メイン
              </span>
            )}
            <button
              onClick={() => removePhoto(url)}
              className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-sm text-white"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-400"
        >
          {uploading ? "追加中…" : "📷 + 追加"}
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center font-semibold">
          {message}
        </p>
      )}

      {/* ステータス操作 */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => changeStatus("出品中")}
          disabled={busy}
          className="rounded-xl bg-sky-600 p-3 font-bold text-white disabled:opacity-50"
        >
          出品中にする
        </button>
        <button
          onClick={() => changeStatus("売れた")}
          disabled={busy}
          className="rounded-xl bg-amber-500 p-3 font-bold text-white disabled:opacity-50"
        >
          売れた!
        </button>
        <button
          onClick={() => changeStatus("梱包依頼")}
          disabled={busy}
          className="rounded-xl bg-orange-600 p-3 font-bold text-white disabled:opacity-50"
        >
          📣 梱包発送を依頼
        </button>
        <button
          onClick={() => changeStatus("発送済み")}
          disabled={busy}
          className="rounded-xl bg-green-600 p-3 font-bold text-white disabled:opacity-50"
        >
          発送済みにする
        </button>
      </div>

      {item.intl && (
        <Link
          href={`/label/${item.id}`}
          className="mt-3 block rounded-xl bg-purple-600 p-4 text-center text-lg font-bold text-white"
        >
          ✈️ 海外発送ラベルを表示・印刷
        </Link>
      )}

      {/* 編集フォーム */}
      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="font-semibold">商品名</span>
          <input
            className={input}
            value={item.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-semibold">商品リンク</span>
          <input
            className={input}
            value={item.listingUrl}
            onChange={(e) => set("listingUrl", e.target.value)}
          />
        </label>
        {item.listingUrl && (
          <a
            href={item.listingUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-indigo-600 underline"
          >
            出品ページを開く ↗
          </a>
        )}

        {/* 販売価格 + 通貨 */}
        <div>
          <span className="font-semibold">販売価格</span>
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-lg"
              type="number"
              inputMode="decimal"
              value={item.price || ""}
              onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
            />
            <div className="flex shrink-0 overflow-hidden rounded-xl border-2 border-slate-200">
              {(["USD", "JPY"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("currency", c)}
                  className={`px-4 text-lg font-bold ${
                    item.currency === c
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-500"
                  }`}
                >
                  {c === "USD" ? "$" : "¥"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold">仕入れ値 (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={item.costJPY || ""}
              onChange={(e) => set("costJPY", parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="font-semibold">送料 (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={item.shippingJPY || ""}
              onChange={(e) => set("shippingJPY", parseFloat(e.target.value) || 0)}
            />
          </label>
        </div>
        <label className="block">
          <span className="font-semibold">保管場所</span>
          <input
            className={input}
            value={item.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="font-semibold">追跡番号</span>
          <input
            className={input}
            value={item.tracking}
            onChange={(e) => set("tracking", e.target.value)}
            placeholder="EJ123456789JP"
          />
        </label>
        <div className="flex items-center justify-between rounded-xl bg-white p-3">
          <span className="font-semibold">✈️ 海外発送の商品</span>
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={item.intl}
            onChange={(e) => set("intl", e.target.checked)}
          />
        </div>

        {item.intl && (
          <div className="space-y-4 rounded-2xl border-2 border-purple-200 bg-purple-50 p-4">
            <p className="font-bold text-purple-700">✈️ 海外発送の宛先(英語で入力)</p>
            <label className="block">
              <span className="font-semibold">宛名</span>
              <input
                className={input}
                value={item.buyerName}
                onChange={(e) => set("buyerName", e.target.value)}
                placeholder="John Smith"
              />
            </label>
            <label className="block">
              <span className="font-semibold">住所</span>
              <textarea
                className={input}
                rows={3}
                value={item.buyerAddress}
                onChange={(e) => set("buyerAddress", e.target.value)}
                placeholder={"123 Main St\nSpringfield, IL 62704"}
              />
            </label>
            <label className="block">
              <span className="font-semibold">国</span>
              <input
                className={input}
                value={item.buyerCountry}
                onChange={(e) => set("buyerCountry", e.target.value)}
                placeholder="USA"
              />
            </label>
            <label className="block">
              <span className="font-semibold">内容品(税関申告用)</span>
              <input
                className={input}
                value={item.contents}
                onChange={(e) => set("contents", e.target.value)}
                placeholder="Wristwatch (used)"
              />
            </label>
          </div>
        )}

        <label className="block">
          <span className="font-semibold">メモ</span>
          <textarea
            className={input}
            rows={2}
            value={item.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="mt-6 w-full rounded-2xl bg-indigo-600 p-4 text-xl font-bold text-white disabled:opacity-50"
      >
        {busy ? "保存中…" : "保存する"}
      </button>
    </main>
  );
}
