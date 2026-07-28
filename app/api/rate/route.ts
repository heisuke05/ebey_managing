import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getUsdJpyRate } from "@/lib/profit";
import { getSettings } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [rate, settings] = await Promise.all([
      getUsdJpyRate(),
      getSettings().catch(() => ({}) as Record<string, string>),
    ]);
    const feeRate = parseFloat(settings["eBay手数料率"] ?? "") || 0.1435;
    return NextResponse.json({ rate, feeRate });
  } catch {
    return NextResponse.json({ rate: 150, feeRate: 0.1435 });
  }
}
