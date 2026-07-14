"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getName, uploadPhoto } from "@/lib/client";

export default function NewItemPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    listingUrl: "",
    priceUSD: "",
    costJPY: "",
    shippingJPY: "",
    location: "",
    contents: "",
    note: "",
    status: "在庫",
    intl: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setImageUrl(await uploadPhoto(file));
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          imageUrl,
          listingUrl: form.listingUrl.trim(),
          priceUSD: parseFloat(form.priceUSD) || 0,
          costJPY: parseFloat(form.costJPY) || 0,
          shippingJPY: parseFloat(form.shippingJPY) || 0,
          location: form.location.trim(),
          contents: form.contents.trim(),
          note: form.note.trim(),
          status: form.status,
          intl: form.intl,
          who: getName(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }
      router.push("/owner");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-lg";

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/owner" className="text-2xl">
          ←
        </Link>
        <h1 className="text-2xl font-bold text-indigo-700">商品登録</h1>
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
        className="mt-5 flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="商品" className="h-full w-full object-contain" />
        ) : (
          <span className="text-slate-400">
            {uploading ? "アップロード中…" : "📷 タップして写真を追加"}
          </span>
        )}
      </button>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="font-semibold">商品名 *</span>
          <input
            className={input}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例: SEIKO 5 自動巻き腕時計"
          />
        </label>
        <label className="block">
          <span className="font-semibold">商品リンク(eBay等)</span>
          <input
            className={input}
            value={form.listingUrl}
            onChange={(e) => set("listingUrl", e.target.value)}
            placeholder="https://www.ebay.com/itm/..."
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold">販売価格 (USD)</span>
            <input
              className={input}
              type="number"
              inputMode="decimal"
              value={form.priceUSD}
              onChange={(e) => set("priceUSD", e.target.value)}
              placeholder="80"
            />
          </label>
          <label className="block">
            <span className="font-semibold">仕入れ値 (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={form.costJPY}
              onChange={(e) => set("costJPY", e.target.value)}
              placeholder="5000"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="font-semibold">送料見込み (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={form.shippingJPY}
              onChange={(e) => set("shippingJPY", e.target.value)}
              placeholder="2000"
            />
          </label>
          <label className="block">
            <span className="font-semibold">保管場所</span>
            <input
              className={input}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="押入れ上段 箱A"
            />
          </label>
        </div>
        <label className="block">
          <span className="font-semibold">内容品(税関申告用・英語)</span>
          <input
            className={input}
            value={form.contents}
            onChange={(e) => set("contents", e.target.value)}
            placeholder="Wristwatch (used)"
          />
        </label>
        <label className="block">
          <span className="font-semibold">メモ</span>
          <textarea
            className={input}
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between rounded-xl bg-white p-3">
          <span className="font-semibold">✈️ 海外発送の商品</span>
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={form.intl}
            onChange={(e) => set("intl", e.target.checked)}
          />
        </div>
        <label className="block">
          <span className="font-semibold">ステータス</span>
          <select
            className={input}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option>在庫</option>
            <option>出品中</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-600">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={busy || uploading}
        className="mt-6 w-full rounded-2xl bg-indigo-600 p-4 text-xl font-bold text-white disabled:opacity-50"
      >
        {busy ? "登録中…" : "登録する"}
      </button>
    </main>
  );
}
