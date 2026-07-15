"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Role, ROLE_LABELS } from "@/lib/types";
import { getRole, registerPush, saveRole } from "@/lib/client";

const ROLES: { role: Role; emoji: string }[] = [
  { role: "owner", emoji: "👑" },
  { role: "wife", emoji: "🌸" },
  { role: "father", emoji: "👨🏻" },
  { role: "mother", emoji: "👩🏻" },
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
    const role = getRole();
    if (role) {
      fetch("/api/suggestions").then((r) => {
        if (r.ok) router.replace(homeFor(role));
      });
    }
  }, [router]);

  async function login() {
    if (!selected) {
      setError("お名前を選択してください");
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
      await registerPush(selected, ROLE_LABELS[selected]);
      router.replace(homeFor(selected));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-2xl font-bold text-white shadow-lg shadow-zinc-900/20">
          E
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          eBay 家族管理
        </h1>
        <p className="mt-1 text-sm text-zinc-500">お名前を選んでログイン</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {ROLES.map(({ role, emoji }) => (
          <button
            key={role}
            onClick={() => setSelected(role)}
            className={`rounded-2xl border bg-white p-5 text-center transition-all ${
              selected === role
                ? "border-zinc-900 shadow-md ring-2 ring-zinc-900"
                : "border-zinc-200 shadow-sm active:scale-[0.98]"
            }`}
          >
            <div className="text-3xl">{emoji}</div>
            <div className="mt-2 text-lg font-semibold text-zinc-800">
              {ROLE_LABELS[role]}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <label className="text-sm font-medium text-zinc-700">あいことば</label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="家族のあいことば"
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-lg outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={login}
        disabled={busy}
        className="mt-6 w-full rounded-xl bg-zinc-900 py-4 text-lg font-semibold text-white shadow-lg shadow-zinc-900/20 transition active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? "確認中…" : "はじめる"}
      </button>

      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
        「はじめる」を押すと通知の許可を求められます。「許可」を押してください。
      </p>
    </main>
  );
}
