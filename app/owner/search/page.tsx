"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import BarcodeScanner from "@/components/BarcodeScanner";
import BottomNav from "@/components/BottomNav";

interface ActiveMarket {
  count: number;
  sampled: number;
  min: number;
  avg: number;
  max: number;
  currency: string;
  topConditions: { name: string; count: number }[];
}

interface Result {
  configured: boolean;
  active?: ActiveMarket;
  soldUrl: string;
  keyword: string;
  imageUrl?: string;
  error?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const run = useCallback(
    async (opts: { code?: string; q?: string }) => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        let name = opts.q ?? "";
        let imageUrl: string | undefined;
        // バーコードの場合はまず商品名を解決
        if (opts.code) {
          const b = await fetch(`/api/barcode?code=${encodeURIComponent(opts.code)}`);
          const bd = await b.json();
          if (b.ok) {
            name = bd.name;
            imageUrl = bd.imageUrl;
            setKeyword(bd.name);
          } else {
            setError(
              bd.error ||
                "商品名が見つかりませんでした。商品名を入力して検索してください。"
            );
            setLoading(false);
            return;
          }
        }
        const params = new URLSearchParams();
        if (name) params.set("q", name);
        if (opts.code) params.set("gtin", opts.code);
        const res = await fetch(`/api/ebay-search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "検索に失敗しました");
          return;
        }
        setResult({ ...data, imageUrl });
      } catch {
        setError("検索に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const onBarcode = useCallback(
    (code: string) => {
      setScanning(false);
      run({ code });
    },
    [run]
  );

  function registerFromResult() {
    if (!result) return;
    const params = new URLSearchParams();
    params.set("name", result.keyword);
    if (result.imageUrl) params.set("image", result.imageUrl);
    router.push(`/owner/new?${params.toString()}`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      {scanning && (
        <BarcodeScanner onDetect={onBarcode} onClose={() => setScanning(false)} />
      )}

      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        商品検索(仕入れ相場)
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        店舗でバーコードをスキャンして、eBayの相場をその場で確認できます。
      </p>

      <button
        onClick={() => setScanning(true)}
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-zinc-900 py-4 text-base font-semibold text-white shadow-lg shadow-zinc-900/20 active:scale-[0.99] disabled:opacity-40"
      >
        バーコードをスキャン
      </button>

      <div className="mt-3 flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && keyword.trim()) run({ q: keyword.trim() });
          }}
          placeholder="または商品名で検索"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
        />
        <button
          onClick={() => keyword.trim() && run({ q: keyword.trim() })}
          disabled={loading || !keyword.trim()}
          className="shrink-0 rounded-xl border border-zinc-300 bg-white px-5 text-base font-semibold text-zinc-800 active:scale-[0.97] disabled:opacity-40"
        >
          検索
        </button>
      </div>

      {loading && (
        <p className="mt-8 text-center text-zinc-400">eBayを検索中…</p>
      )}

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.keyword}
                className="h-16 w-16 shrink-0 rounded-xl border border-zinc-100 bg-zinc-50 object-contain"
              />
            ) : null}
            <p className="min-w-0 font-semibold text-zinc-900">{result.keyword}</p>
          </div>

          {/* 現在の出品相場(Browse API) */}
          {result.configured && result.active ? (
            result.active.sampled > 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-zinc-500">
                  現在の出品相場(USD)
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-zinc-400">最安</p>
                    <p className="text-lg font-semibold text-zinc-900">
                      ${result.active.min.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">平均</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      ${result.active.avg.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">最高</p>
                    <p className="text-lg font-semibold text-zinc-900">
                      ${result.active.max.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  現在の出品数: 約{result.active.count.toLocaleString()}件
                  <span className="text-zinc-400">
                    (相場は上位{result.active.sampled}件から算出)
                  </span>
                </p>
                {result.active.topConditions.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">
                    状態:{" "}
                    {result.active.topConditions
                      .map((c) => `${c.name}(${c.count})`)
                      .join(" / ")}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
                現在この商品の出品は見つかりませんでした。売り切れ相場を確認してみてください。
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              eBay APIキーが未設定のため、現在の相場は表示できません。下のボタンから売り切れ相場を確認できます。
            </div>
          )}

          {/* 売り切れ相場(eBayを開く) */}
          <a
            href={result.soldUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-zinc-900 p-5 text-center shadow-lg shadow-zinc-900/20 active:scale-[0.99]"
          >
            <p className="text-base font-semibold text-white">
              eBayで売り切れ相場を見る ↗
            </p>
            <p className="mt-1 text-xs text-zinc-300">
              過去に実際いくらで売れたか・売れ行きを確認
            </p>
          </a>

          <button
            onClick={registerFromResult}
            className="w-full rounded-xl border border-zinc-300 bg-white py-3.5 text-base font-semibold text-zinc-800 active:scale-[0.99]"
          >
            この商品を在庫に登録する
          </button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
