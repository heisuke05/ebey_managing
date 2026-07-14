import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, makeToken } from "@/lib/auth";
import { ensureSetup } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  const token = makeToken(String(passcode ?? ""));
  if (!token) {
    return NextResponse.json({ error: "あいことばが違います" }, { status: 401 });
  }
  // 初回ログイン時にスプレッドシートのタブを自動作成
  try {
    await ensureSetup();
  } catch (e) {
    console.error("ensureSetup failed:", e);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
