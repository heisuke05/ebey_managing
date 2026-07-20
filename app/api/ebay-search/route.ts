import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import {
  buildSoldSearchUrl,
  ebayConfigured,
  searchActiveMarket,
} from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const gtin = (req.nextUrl.searchParams.get("gtin") ?? "").replace(/\D/g, "");
  const keyword = q || gtin;
  if (!keyword) {
    return NextResponse.json({ error: "検索キーワードがありません" }, { status: 400 });
  }

  const soldUrl = buildSoldSearchUrl(q || gtin);

  if (!ebayConfigured()) {
    // eBay APIキー未設定でも、売り切れページへのリンクは返す
    return NextResponse.json({
      configured: false,
      soldUrl,
      keyword: q || gtin,
    });
  }

  try {
    const active = await searchActiveMarket(q, gtin || undefined);
    return NextResponse.json({
      configured: true,
      active,
      soldUrl,
      keyword: q || gtin,
    });
  } catch (e) {
    // API側で失敗しても売り切れリンクは使えるようにする
    return NextResponse.json({
      configured: true,
      error: String(e),
      soldUrl,
      keyword: q || gtin,
    });
  }
}
