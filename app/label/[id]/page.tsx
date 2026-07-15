"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Item } from "@/lib/types";

export default function LabelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/items/${id}`);
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setItem(data.item);
        setSettings(data.settings ?? {});
      } else {
        setError(data.error || "読み込みに失敗しました");
      }
    })();
  }, [id, router]);

  if (!item) {
    return (
      <main className="p-10 text-center text-slate-400">
        {error || "読み込み中…"}
      </main>
    );
  }

  const senderName = settings["差出人名(ローマ字)"] || "(設定シートで差出人名を入力)";
  const senderAddress =
    settings["差出人住所(英語表記)"] || "(設定シートで差出人住所を入力)";
  const senderPhone = settings["差出人電話"] || "";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/owner/item/${item.id}`}
          className="text-sm font-medium text-zinc-600 underline underline-offset-2"
        >
          ← 商品に戻る
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-zinc-900/15 active:scale-[0.97]"
        >
          印刷する
        </button>
      </div>

      <div className="border-4 border-black p-8">
        <div className="border-b-2 border-black pb-4">
          <p className="text-xs font-bold tracking-widest">FROM (差出人)</p>
          <p className="mt-1 text-lg font-bold">{senderName}</p>
          <p className="whitespace-pre-wrap">{senderAddress}</p>
          <p>JAPAN</p>
          {senderPhone && <p>TEL: {senderPhone}</p>}
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold tracking-widest">TO (宛先)</p>
          <p className="mt-2 text-3xl font-bold">{item.buyerName || "—"}</p>
          <p className="mt-2 whitespace-pre-wrap text-xl">
            {item.buyerAddress || "(宛先住所が未入力です)"}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-widest">
            {(item.buyerCountry || "").toUpperCase()}
          </p>
        </div>

        <div className="mt-8 border-t-2 border-black pt-4 text-sm">
          <p className="text-xs font-bold tracking-widest">
            CUSTOMS DECLARATION (税関申告)
          </p>
          <table className="mt-2 w-full border-collapse">
            <tbody>
              <tr>
                <td className="border border-black p-2 font-bold">Contents</td>
                <td className="border border-black p-2">
                  {item.contents || item.name}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-bold">Value</td>
                <td className="border border-black p-2">
                  {item.currency}{" "}
                  {item.currency === "JPY"
                    ? item.price.toLocaleString()
                    : item.price.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-bold">Category</td>
                <td className="border border-black p-2">Merchandise</td>
              </tr>
              {item.tracking && (
                <tr>
                  <td className="border border-black p-2 font-bold">Tracking</td>
                  <td className="border border-black p-2">{item.tracking}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="no-print mt-4 text-sm text-slate-500">
        ※ 差出人情報はスプレッドシートの「設定」タブで変更できます。実際の発送では日本郵便の国際マイページ等で正式ラベルの作成が必要な場合があります。この画面は同梱用・控え用としてご利用ください。
      </p>
    </main>
  );
}
