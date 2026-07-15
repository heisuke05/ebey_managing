"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item, ItemStatus, STATUSES, priceLabel } from "@/lib/types";
import { calcProfit } from "@/lib/profit";

/** 桁数が多いほど小さいフォントを返す(カードからのはみ出し防止) */
function fitText(s: string): string {
  if (s.length > 11) return "text-xs";
  if (s.length > 8) return "text-sm";
  if (s.length > 6) return "text-base";
  return "text-lg";
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  在庫: "bg-zinc-100 text-zinc-600 ring-zinc-500/10",
  出品中: "bg-blue-50 text-blue-700 ring-blue-600/10",
  売れた: "bg-amber-50 text-amber-700 ring-amber-600/10",
  梱包依頼: "bg-orange-50 text-orange-700 ring-orange-600/10",
  発送済み: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
};

export default function OwnerPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [rate, setRate] = useState(150);
  const [feeRate, setFeeRate] = useState(0.1435);
  const [filter, setFilter] = useState<ItemStatus | "全て">("全て");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "読み込みに失敗しました");
        return;
      }
      setItems(data.items ?? []);
      setRate(data.rate ?? 150);
      setFeeRate(data.feeRate ?? 0.1435);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = filter === "全て" ? items : items.filter((i) => i.status === filter);
  const activeItems = items.filter((i) => i.status !== "発送済み");
  const totalProfit = activeItems.reduce(
    (sum, i) => sum + calcProfit(i, rate, feeRate).profitJPY,
    0
  );
  const profitText = `¥${totalProfit.toLocaleString()}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          在庫管理
        </h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            aria-label="更新"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm active:scale-[0.97]"
          >
            更新
          </button>
          <Link
            href="/owner/suggestions"
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm active:scale-[0.97]"
          >
            AI提案
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-3.5 text-center shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            在庫・出品中
          </p>
          <p className="mt-0.5 text-lg font-semibold text-zinc-900">
            {items.filter((i) => i.status === "在庫" || i.status === "出品中").length}
          </p>
        </div>
        <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-3.5 text-center shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            想定利益合計
          </p>
          <p
            className={`mt-0.5 break-all font-semibold leading-tight text-emerald-600 ${fitText(profitText)}`}
          >
            {profitText}
          </p>
        </div>
        <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-3.5 text-center shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            USD/JPY
          </p>
          <p className="mt-0.5 text-lg font-semibold text-zinc-900">
            {rate.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {(["全て", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === s
                ? "bg-zinc-900 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {s}
            {s !== "全て" && (
              <span className="ml-1 opacity-60">
                {items.filter((i) => i.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-12 text-center text-zinc-400">読み込み中…</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {shown.map((item) => {
            const p = calcProfit(item, rate, feeRate);
            return (
              <Link
                key={item.id}
                href={`/owner/item/${item.id}`}
                className="flex gap-3.5 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition active:scale-[0.995]"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-xl border border-zinc-100 bg-zinc-50 object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xl text-zinc-300">
                    📷
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-zinc-900">
                      {item.name}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {priceLabel(item)}
                    <span className="mx-1.5 text-zinc-300">|</span>
                    仕入 ¥{item.costJPY.toLocaleString()}
                    {item.intl && (
                      <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-600">
                        海外
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">
                    利益 ¥{p.profitJPY.toLocaleString()}
                  </p>
                  {item.location && (
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {item.location}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
          {shown.length === 0 && (
            <p className="mt-12 text-center text-zinc-400">商品がありません</p>
          )}
        </div>
      )}

      <Link
        href="/owner/new"
        className="fixed bottom-6 right-6 rounded-full bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-xl shadow-zinc-900/25 active:scale-[0.97]"
      >
        + 商品登録
      </Link>
    </main>
  );
}
