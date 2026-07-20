"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Currency } from "@/lib/types";
import { getName, uploadPhoto } from "@/lib/client";
import BarcodeScanner from "@/components/BarcodeScanner";

const input =
  "mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10";
const label = "text-sm font-medium text-zinc-700";

function NewItemForm() {
  const router = useRouter();
  const search = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const prefillImage = search.get("image");
  const [photos, setPhotos] = useState<string[]>(
    prefillImage ? [prefillImage] : []
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [form, setForm] = useState({
    name: search.get("name") ?? "",
    listingUrl: "",
    price: "",
    currency: "USD" as Currency,
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
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        const url = await uploadPhoto(file);
        setPhotos((p) => [...p, url]);
      }
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotos((p) => p.filter((u) => u !== url));
  }

  const onBarcode = useCallback(async (code: string) => {
    setScanning(false);
    setLookingUp(true);
    setError("");
    setInfo(`バーコード ${code} の商品を検索中…`);
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setInfo("");
        setError(data.error || "商品情報が見つかりませんでした");
        return;
      }
      setForm((f) => ({ ...f, name: data.name || f.name }));
      if (data.imageUrl) {
        setPhotos((p) => (p.includes(data.imageUrl) ? p : [...p, data.imageUrl]));
      }
      setInfo(`商品情報を取得しました: ${data.name}`);
    } catch {
      setInfo("");
      setError("商品検索に失敗しました");
    } finally {
      setLookingUp(false);
    }
  }, []);

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
          imageUrl: photos[0] ?? "",
          images: photos.slice(1),
          listingUrl: form.listingUrl.trim(),
          price: parseFloat(form.price) || 0,
          currency: form.currency,
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

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      {scanning && (
        <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />
      )}

      <div className="flex items-center gap-3">
        <Link
          href="/owner"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          商品登録
        </h1>
      </div>

      <button
        onClick={() => setScanning(true)}
        disabled={lookingUp}
        className="mt-5 w-full rounded-xl border border-zinc-200 bg-white py-3.5 text-base font-semibold text-zinc-800 shadow-sm active:scale-[0.99] disabled:opacity-40"
      >
        {lookingUp ? "検索中…" : "バーコードをスキャンして自動入力"}
      </button>
      {info && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {info}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPhoto}
      />

      <div className="mt-6">
        <span className={label}>写真(複数可・1枚目がメイン)</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`写真${i + 1}`}
                className="h-28 w-full rounded-xl border border-zinc-200 bg-zinc-50 object-contain"
              />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  メイン
                </span>
              )}
              <button
                onClick={() => removePhoto(url)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/70 text-xs text-white backdrop-blur"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-400 active:scale-[0.98]"
          >
            {uploading ? "追加中…" : "+ 追加"}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <span className={label}>商品名 *</span>
          <input
            className={input}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例: SEIKO 5 自動巻き腕時計"
          />
        </div>
        <div>
          <span className={label}>商品リンク(eBay等)</span>
          <input
            className={input}
            value={form.listingUrl}
            onChange={(e) => set("listingUrl", e.target.value)}
            placeholder="https://www.ebay.com/itm/..."
          />
        </div>

        <div>
          <span className={label}>販売価格</span>
          <div className="mt-1.5 flex gap-2">
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
              type="number"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder={form.currency === "USD" ? "80" : "12000"}
            />
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-zinc-300">
              {(["USD", "JPY"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("currency", c)}
                  className={`px-4 text-base font-semibold transition ${
                    form.currency === c
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-400"
                  }`}
                >
                  {c === "USD" ? "$" : "¥"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>仕入れ値 (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={form.costJPY}
              onChange={(e) => set("costJPY", e.target.value)}
              placeholder="5000"
            />
          </div>
          <div>
            <span className={label}>送料見込み (円)</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={form.shippingJPY}
              onChange={(e) => set("shippingJPY", e.target.value)}
              placeholder="2000"
            />
          </div>
        </div>
        <div>
          <span className={label}>保管場所</span>
          <input
            className={input}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="押入れ上段 箱A"
          />
        </div>
        <div>
          <span className={label}>内容品(税関申告用・英語)</span>
          <input
            className={input}
            value={form.contents}
            onChange={(e) => set("contents", e.target.value)}
            placeholder="Wristwatch (used)"
          />
        </div>
        <div>
          <span className={label}>メモ</span>
          <textarea
            className={input}
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
          <span className="text-base font-medium text-zinc-800">海外発送の商品</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-zinc-900"
            checked={form.intl}
            onChange={(e) => set("intl", e.target.checked)}
          />
        </label>
        <div>
          <span className={label}>ステータス</span>
          <select
            className={input}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option>在庫</option>
            <option>出品中</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy || uploading}
        className="mt-6 w-full rounded-xl bg-zinc-900 py-4 text-lg font-semibold text-white shadow-lg shadow-zinc-900/20 active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? "登録中…" : "登録する"}
      </button>
    </main>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center text-zinc-400">読み込み中…</main>}>
      <NewItemForm />
    </Suspense>
  );
}
