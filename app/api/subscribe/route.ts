import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { addSubscription } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { subscription, role, name } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    await addSubscription({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      role: role ?? "",
      name: name ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
