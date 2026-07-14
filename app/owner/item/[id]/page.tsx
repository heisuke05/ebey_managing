"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item, ItemStatus } from "@/lib/types";
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
        listingUrl: item.listingUrl,
        priceUSD: item.priceUSD,
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
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      set("imageUrl", url);
      await patch({ imageUrl: url }, "✅ 写真を更新しました");
    } catch (err) {
      setMessage(String((err as Error).message ?? err));
    } finally {
      setUploading(false);
    }
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10 text-center text-slate-400">
        {message || "読み込み中…"}
      </main>
    );
  }

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
        className="hidden"
        onChange={onPhoto}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="mt-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-slate-400">
            {uploading ? "アップロード中…" : "📷 タップして写真を追加"}
          </span>
        )}
      </button>

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
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold">販売価格 (USD)</span>
            <input
              className={input}
              type="number"
              inputMode="decimal"
              value={item.priceUSD || ""}
              onChange={(e) => set("priceUSD", parseFloat(e.target.value) || 0)}
            />
          </label>
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
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <label className="block">
            <span className="font-semibold">保管場所</span>
            <input
              className={input}
              value={item.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
        </div>
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
