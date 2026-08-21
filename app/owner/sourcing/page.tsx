"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getRole } from "@/lib/client";

interface SItem {
  name: string;
  buyJPY: number;
  sellUSD: number;
  grams: number;
  shipJPY: number;
  marginPct: number;
  profitJPY: number;
  note: string;
}
interface STier {
  budget: number;
  items: SItem[];
}
interface SResult {
  date: string;
  rate: number;
  tiers: STier[];
}

function mercariUrl(n: string) {
  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(n)}`;
}
function yahooUrl(n: string) {
  return `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(n)}`;
}
function ebayUrl(n: string) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    n
  )}&LH_Sold=1&LH_Complete=1&_sop=13`;
}

export default function SourcingPage() {
  const router = useRouter();
  const [result, setResult] = useState<SResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (getRole() !== "owner") router.replace("/owner");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sourcing");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      if (res.ok) setResult(data.latest);
      else setMessage(data.error || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    if (
      !confirm(
        "メルカリ/ヤフオク→eBayの仕入れリサーチを実行しますか?\n1〜3分・約150〜250円かかります。"
      )
    )
      return;
    setRunning(true);
    setMessage("AIが市場をリサーチしています(1〜3分)。画面を閉じずにお待ちください…");
    try {
      const res = await fetch("/api/sourcing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "リサーチに失敗しました");
        return;
      }
      setResult(data.result);
      setMessage("");
    } catch {
      setMessage("リサーチに失敗しました。もう一度お試しください。");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        仕入れリサーチ
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        メルカリ・ヤフオクで仕入れ、eBayで売る想定で、粗利率25%以上を狙える商品を予算別に提案します(送料・手数料・関税5%を差引後)。
      </p>

      <button
        onClick={run}
        disabled={running}
        className="mt-4 w-full rounded-xl bg-zinc-900 py-4 text-base font-semibold text-white shadow-lg shadow-zinc-900/20 active:scale-[0.99] disabled:opacity-40"
      >
        {running ? "リサーチ中…" : "リサーチを実行(約150〜250円)"}
      </button>

      {message && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-12 text-center text-zinc-400">読み込み中…</p>
      ) : !result ? (
        <p className="mt-12 text-center text-zinc-400">
          まだリサーチ結果がありません。「リサーチを実行」を押してください。
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          <p className="text-xs text-zinc-400">
            {new Date(result.date).toLocaleString("ja-JP")} 実行 / 為替 1USD=
            {result.rate.toFixed(1)}円
          </p>
          {result.tiers.map((tier) => (
            <section key={tier.budget}>
              <h2 className="text-base font-semibold text-zinc-900">
                仕入れ予算 ≤ ¥{tier.budget.toLocaleString()}
              </h2>
              {tier.items.length === 0 ? (
                <p className="mt-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-500">
                  条件(粗利率25%以上)を満たす候補が見つかりませんでした。
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {tier.items.map((it, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-zinc-900">{it.name}</p>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          粗利 {it.marginPct}%
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-xs text-zinc-400">仕入れ</p>
                          <p className="font-semibold text-zinc-900">
                            ¥{it.buyJPY.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">eBay売価</p>
                          <p className="font-semibold text-zinc-900">
                            ${it.sellUSD.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">想定粗利</p>
                          <p className="font-semibold text-emerald-600">
                            ¥{it.profitJPY.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {it.note && (
                        <p className="mt-2 text-xs text-zinc-500">{it.note}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <a
                          href={mercariUrl(it.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-center text-xs font-semibold text-zinc-700 active:scale-[0.97]"
                        >
                          メルカリ ↗
                        </a>
                        <a
                          href={yahooUrl(it.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-center text-xs font-semibold text-zinc-700 active:scale-[0.97]"
                        >
                          ヤフオク ↗
                        </a>
                        <a
                          href={ebayUrl(it.name)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-lg border border-zinc-200 bg-white py-2 text-center text-xs font-semibold text-zinc-700 active:scale-[0.97]"
                        >
                          eBay相場 ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
          <p className="text-xs leading-relaxed text-zinc-400">
            ※ 価格・粗利は推定です。実際の出品在庫・状態・送料をリンク先で必ず確認してください。相場は変動します。
          </p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
