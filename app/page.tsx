"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Role, ROLE_LABELS } from "@/lib/types";
import { getRole, registerPush, saveRole } from "@/lib/client";

const ROLES: { role: Role; emoji: string }[] = [
  { role: "owner", emoji: "👑" },
  { role: "wife", emoji: "🌸" },
  { role: "father", emoji: "👴" },
  { role: "mother", emoji: "👵" },
];

function homeFor(role: Role): string {
  return role === "father" || role === "mother" ? "/family" : "/owner";
}

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [selected, setSelected] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // すでにログイン済みならホームへ
    const role = getRole();
    if (role) {
      fetch("/api/suggestions").then((r) => {
        if (r.ok) router.replace(homeFor(role));
      });
    }
  }, [router]);

  async function login() {
    if (!selected) {
      setError("あなたの名前をタップしてください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "ログインできませんでした");
        return;
      }
      saveRole(selected, ROLE_LABELS[selected]);
      // 通知の許可(失敗しても先へ進む)
      await registerPush(selected, ROLE_LABELS[selected]);
      router.replace(homeFor(selected));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-center text-3xl font-bold text-indigo-700">
        eBay 家族管理
      </h1>
      <p className="mt-2 text-center text-slate-500">
        あなたはどなたですか?
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {ROLES.map(({ role, emoji }) => (
          <button
            key={role}
            onClick={() => setSelected(role)}
            className={`rounded-2xl border-4 p-6 text-center shadow-sm transition ${
              selected === role
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-5xl">{emoji}</div>
            <div className="mt-2 text-2xl font-bold">{ROLE_LABELS[role]}</div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <label className="block text-lg font-semibold">あいことば</label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="家族のあいことば"
          className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white p-4 text-2xl"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-lg font-semibold text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={login}
        disabled={busy}
        className="mt-6 w-full rounded-2xl bg-indigo-600 p-5 text-2xl font-bold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? "確認中…" : "はじめる"}
      </button>

      <p className="mt-6 text-center text-sm text-slate-400">
        「はじめる」を押すと通知の許可を求められます。
        <br />
        「許可」を押してください。
      </p>
    </main>
  );
}
