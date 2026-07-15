"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item, ItemStatus, STATUSES, priceLabel } from "@/lib/types";
import { calcProfit } from "@/lib/profit";

const STATUS_COLORS: Record<ItemStatus, string> = {
  在庫: "bg-slate-200 text-slate-700",
  出品中: "bg-sky-100 text-sky-700",
  売れた: "bg-amber-100 text-amber-700",
  梱包依頼: "bg-orange-100 text-orange-700",
  発送済み: "bg-green-100 text-green-700",
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

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-indigo-700">在庫管理</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-lg bg-slate-200 px-3 py-2 font-semibold"
          >
            🔄
          </button>
          <Link
            href="/owner/suggestions"
            className="rounded-lg bg-purple-100 px-3 py-2 font-semibold text-purple-700"
          >
            💡 AI提案
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-400">在庫・出品中</p>
          <p className="text-xl font-bold">
            {items.filter((i) => i.status === "在庫" || i.status === "出品中").length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-400">想定利益合計</p>
          <p className="text-xl font-bold text-green-600">
            ¥{totalProfit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-400">USD/JPY</p>
          <p className="text-xl font-bold">{rate.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(["全て", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              filter === s ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
            }`}
          >
            {s}
            {s !== "全て" && (
              <span className="ml-1 text-xs">
                {items.filter((i) => i.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-400">読み込み中…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {shown.map((item) => {
            const p = calcProfit(item, rate, feeRate);
            return (
              <Link
                key={item.id}
                href={`/owner/item/${item.id}`}
                className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-xl bg-slate-50 object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                    📷
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-bold">{item.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {priceLabel(item)} / 仕入 ¥{item.costJPY.toLocaleString()}
                    {item.intl && " ✈️"}
                  </p>
                  <p className="text-sm font-semibold text-green-600">
                    想定利益 ¥{p.profitJPY.toLocaleString()}
                  </p>
                  {item.location && (
                    <p className="text-xs text-slate-400">📍 {item.location}</p>
                  )}
                </div>
              </Link>
            );
          })}
          {shown.length === 0 && (
            <p className="mt-10 text-center text-slate-400">商品がありません</p>
          )}
        </div>
      )}

      <Link
        href="/owner/new"
        className="fixed bottom-6 right-6 rounded-full bg-indigo-600 px-6 py-4 text-lg font-bold text-white shadow-xl"
      >
        + 商品登録
      </Link>
    </main>
  );
}
