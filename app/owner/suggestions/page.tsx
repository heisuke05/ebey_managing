"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Suggestion } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

export default function SuggestionsPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions");
      if (res.status === 401) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      if (res.ok) setSuggestions(data.suggestions ?? []);
      else setMessage(data.error || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    if (!confirm("AI市場調査を今すぐ実行しますか?(1〜3分かかります)")) return;
    setRunning(true);
    setMessage("AIが市場を調査しています。数分お待ちください…");
    try {
      const res = await fetch("/api/ai-suggest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "実行に失敗しました");
        return;
      }
      setMessage("新しい提案が届きました");
      await load();
    } catch {
      setMessage("実行に失敗しました");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-zinc-900">
          AI市場サジェスチョン
        </h1>
        <button
          onClick={runNow}
          disabled={running}
          className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-zinc-900/15 active:scale-[0.97] disabled:opacity-40"
        >
          {running ? "調査中…" : "今すぐ実行"}
        </button>
      </div>

      <p className="mt-2 text-sm text-zinc-500">
        毎週月曜の朝に自動で市場を調査し、おすすめ商品を提案します。
      </p>

      {message && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-12 text-center text-zinc-400">読み込み中…</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-12 text-center text-zinc-400">
          まだ提案がありません。「今すぐ実行」を押してみてください。
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-zinc-900">{s.title}</p>
                <p className="shrink-0 text-xs text-zinc-400">
                  {new Date(s.date).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {s.body}
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
