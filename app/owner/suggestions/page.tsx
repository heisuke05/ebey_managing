"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suggestion } from "@/lib/types";

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
    setMessage("🔍 AIが市場を調査しています。数分お待ちください…");
    try {
      const res = await fetch("/api/ai-suggest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ ${data.error || "実行に失敗しました"}`);
        return;
      }
      setMessage("✅ 新しい提案が届きました");
      await load();
    } catch {
      setMessage("❌ 実行に失敗しました");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/owner" className="text-2xl">
          ←
        </Link>
        <h1 className="flex-1 text-2xl font-bold text-purple-700">
          💡 AI市場サジェスチョン
        </h1>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white disabled:opacity-50"
        >
          {running ? "調査中…" : "今すぐ実行"}
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        毎週月曜の朝に自動で市場を調査し、おすすめ商品を提案します。
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-purple-50 p-3 font-semibold text-purple-700">
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-400">読み込み中…</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-10 text-center text-slate-400">
          まだ提案がありません。「今すぐ実行」を押してみてください。
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-bold text-purple-700">{s.title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(s.date).toLocaleString("ja-JP")}
              </p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {s.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
