import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { createItem, listItems, addLog, getSettings } from "@/lib/sheets";
import { getUsdJpyRate } from "@/lib/profit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [items, rate, settings] = await Promise.all([
      listItems(),
      getUsdJpyRate(),
      getSettings().catch(() => ({}) as Record<string, string>),
    ]);
    const feeRate = parseFloat(settings["eBay手数料率"] ?? "") || 0.1435;
    return NextResponse.json({ items, rate, feeRate });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "商品名は必須です" }, { status: 400 });
    const item = await createItem(body);
    await addLog(body.who ?? "", item.id, item.name, "商品登録");
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
