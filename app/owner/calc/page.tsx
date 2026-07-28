"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BarcodeScanner from "@/components/BarcodeScanner";
import { WEIGHT_PRESETS, estimateShippingJPY } from "@/lib/shipping";

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-lg outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10";
const label = "text-sm font-medium text-zinc-700";

function verdict(margin: number, profit: number): { text: string; cls: string } {
  if (profit <= 0) return { text: "✕ 赤字", cls: "bg-red-50 text-red-600" };
  if (margin >= 0.25) return { text: "◎ おすすめ", cls: "bg-emerald-50 text-emerald-700" };
  if (margin >= 0.15) return { text: "○ 良好", cls: "bg-emerald-50 text-emerald-700" };
  if (margin >= 0.08) return { text: "△ 薄利", cls: "bg-amber-50 text-amber-700" };
  return { text: "△ 要検討", cls: "bg-amber-50 text-amber-700" };
}

function CalcForm() {
  const router = useRouter();
  const search = useSearchParams();

  const [rate, setRate] = useState(150);
  const [feeRate, setFeeRate] = useState(0.1435);
  const [name, setName] = useState(search.get("name") ?? "");
  const [sellUSD, setSellUSD] = useState(search.get("price") ?? "");
  const [costJPY, setCostJPY] = useState(search.get("cost") ?? "");
  const [grams, setGrams] = useState("");
  const [shipping, setShipping] = useState("");
  const [shippingEdited, setShippingEdited] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceNote, setPriceNote] = useState("");
  const [priceError, setPriceError] = useState("");

  // バーコードから商品名を解決(無料)
  const onBarcode = useCallback(async (code: string) => {
    setScanning(false);
    setPriceError("");
    setPriceNote("バーコードから商品名を取得中…");
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setPriceNote("");
        setPriceError(data.error || "商品名が見つかりませんでした。手入力してください。");
        return;
      }
      setName(data.name);
      setPriceNote("商品名を取得しました。「eBay相場を取得」で価格を自動入力できます。");
    } catch {
      setPriceNote("");
      setPriceError("商品名の取得に失敗しました");
    }
  }, []);

  // eBayの平均相場を自動取得(Claude+Web検索・約10円)
  async function fetchEbayPrice() {
    if (!name.trim()) {
      setPriceError("先に商品名を入力またはスキャンしてください");
      return;
    }
    setPriceLoading(true);
    setPriceError("");
    setPriceNote("eBayの相場を調べています(10〜20秒)…");
    try {
      const res = await fetch("/api/ebay-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const raw = await res.text();
      let data: {
        found?: boolean;
        avgUSD?: number;
        lowUSD?: number | null;
        highUSD?: number | null;
        note?: string;
        error?: string;
      } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        setPriceNote("");
        setPriceError(`サーバーエラー (HTTP ${res.status})。もう一度お試しください。`);
        return;
      }
      if (!res.ok || data.error) {
        setPriceNote("");
        setPriceError(data.error || "相場の取得に失敗しました");
        return;
      }
      if (!data.found || data.avgUSD == null) {
        setPriceNote("");
        setPriceError(data.note || "相場が見つかりませんでした。手入力してください。");
        return;
      }
      setSellUSD(String(data.avgUSD));
      const range =
        data.lowUSD != null && data.highUSD != null
          ? `(相場帯 $${data.lowUSD}〜$${data.highUSD})`
          : "";
      setPriceNote(
        `eBay平均 $${data.avgUSD} を入力しました ${range}${
          data.note ? ` ／ ${data.note}` : ""
        }`
      );
    } catch {
      setPriceNote("");
      setPriceError("相場の取得に失敗しました。電波状況をご確認ください。");
    } finally {
      setPriceLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/rate").then(async (r) => {
      if (r.status === 401) {
        router.replace("/");
        return;
      }
      const d = await r.json();
      if (d.rate) setRate(d.rate);
      if (d.feeRate) setFeeRate(d.feeRate);
    });
  }, [router]);

  // 重さが変わったら(手動編集していなければ)送料を自動概算
  useEffect(() => {
    if (shippingEdited) return;
    const g = parseFloat(grams);
    if (!isNaN(g) && g > 0) {
      setShipping(String(estimateShippingJPY(g)));
    }
  }, [grams, shippingEdited]);

  const calc = useMemo(() => {
    const sell = parseFloat(sellUSD) || 0;
    const cost = parseFloat(costJPY) || 0;
    const ship = parseFloat(shipping) || 0;
    const hasInput = sell > 0;
    const revenueJPY = sell * rate;
    // 売却額が未入力なら手数料も0にして、空フォームで見かけの赤字が出ないようにする
    const feeJPY = hasInput ? revenueJPY * feeRate + 0.3 * rate : 0;
    const profit = revenueJPY - feeJPY - ship - cost;
    const margin = revenueJPY > 0 ? profit / revenueJPY : 0;
    return {
      revenueJPY: Math.round(revenueJPY),
      feeJPY: Math.round(feeJPY),
      shipJPY: Math.round(ship),
      costJPY: Math.round(cost),
      profit: Math.round(profit),
      margin,
      hasInput,
    };
  }, [sellUSD, costJPY, shipping, rate, feeRate]);

  const v = verdict(calc.margin, calc.profit);

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      {scanning && (
        <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />
      )}

      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        利益計算(店舗調査用)
      </h1>

      {/* 商品名 + スキャン(相場の自動取得に使用) */}
      <div className="mt-4">
        <span className={label}>商品名(相場の自動取得に使用)</span>
        <div className="mt-1.5 flex gap-2">
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="商品名 または スキャン"
          />
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="shrink-0 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 active:scale-[0.97]"
          >
            スキャン
          </button>
        </div>
      </div>

      {/* 結果(常に上部に表示) */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-500">最終利益(概算)</p>
          {calc.hasInput && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.cls}`}>
              {v.text}
            </span>
          )}
        </div>
        <p
          className={`mt-1 text-3xl font-bold ${
            calc.profit >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {calc.profit >= 0 ? "+" : "−"}¥
          {Math.abs(calc.profit).toLocaleString()}
        </p>
        {calc.hasInput && (
          <p className="mt-0.5 text-sm text-zinc-500">
            利益率 {(calc.margin * 100).toFixed(1)}%
          </p>
        )}
        <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 text-sm">
          <Row k="売上" v={`¥${calc.revenueJPY.toLocaleString()}`} plus />
          <Row k={`eBay手数料 (${(feeRate * 100).toFixed(1)}%+$0.30)`} v={`−¥${calc.feeJPY.toLocaleString()}`} />
          <Row k="送料(概算)" v={`−¥${calc.shipJPY.toLocaleString()}`} />
          <Row k="仕入れ" v={`−¥${calc.costJPY.toLocaleString()}`} />
        </div>
      </div>

      {/* 入力 */}
      <div className="mt-6 space-y-5">
        <div>
          <span className={label}>eBay平均売却額(USD)</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-lg text-zinc-400">$</span>
            <input
              className={input}
              type="number"
              inputMode="decimal"
              value={sellUSD}
              onChange={(e) => setSellUSD(e.target.value)}
              placeholder="80"
            />
          </div>
          <button
            type="button"
            onClick={fetchEbayPrice}
            disabled={priceLoading}
            className="mt-2 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-40"
          >
            {priceLoading ? "eBay相場を取得中…" : "eBay相場を自動取得(約10円)"}
          </button>
          {priceNote && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
              {priceNote}
            </p>
          )}
          {priceError && (
            <p className="mt-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
              {priceError}
            </p>
          )}
        </div>

        <div>
          <span className={label}>購入金額(店頭価格・円)</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-lg text-zinc-400">¥</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={costJPY}
              onChange={(e) => setCostJPY(e.target.value)}
              placeholder="5000"
            />
          </div>
        </div>

        <div>
          <span className={label}>商品の重さ(送料の算出用)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEIGHT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setGrams(String(p.grams));
                  setShippingEdited(false);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  grams === String(p.grams)
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={grams}
              onChange={(e) => {
                setGrams(e.target.value);
                setShippingEdited(false);
              }}
              placeholder="重さ(g)を直接入力も可"
            />
            <span className="shrink-0 text-zinc-400">g</span>
          </div>
        </div>

        <div>
          <span className={label}>送料(概算・編集可)</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-lg text-zinc-400">¥</span>
            <input
              className={input}
              type="number"
              inputMode="numeric"
              value={shipping}
              onChange={(e) => {
                setShipping(e.target.value);
                setShippingEdited(true);
              }}
              placeholder="重さから自動計算"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            日本→米国の目安(国際eパケット/EMS相当・梱包材込み)。実際の料金に合わせて修正できます。
          </p>
        </div>

        {/* 詳細設定 */}
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-sm font-medium text-zinc-500 underline underline-offset-2"
        >
          {showAdvanced ? "詳細設定を隠す" : "為替・手数料率を調整する"}
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
            <div>
              <span className={label}>為替(USD/JPY)</span>
              <input
                className={input}
                type="number"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <span className={label}>手数料率(%)</span>
              <input
                className={input}
                type="number"
                inputMode="decimal"
                value={(feeRate * 100).toFixed(2)}
                onChange={(e) =>
                  setFeeRate((parseFloat(e.target.value) || 0) / 100)
                }
              />
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function Row({ k, v, plus }: { k: string; v: string; plus?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{k}</span>
      <span className={plus ? "font-medium text-zinc-900" : "text-zinc-700"}>
        {v}
      </span>
    </div>
  );
}

export default function CalcPage() {
  return (
    <Suspense
      fallback={<main className="p-6 text-center text-zinc-400">読み込み中…</main>}
    >
      <CalcForm />
    </Suspense>
  );
}
