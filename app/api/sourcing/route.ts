import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { addSourcing, listSourcing } from "@/lib/sheets";
import { getUsdJpyRate } from "@/lib/profit";
import { estimateShippingJPY } from "@/lib/shipping";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUFFER_RATE = 0.05; // 関税・予備費バッファ(売価の5%)
const MIN_MARGIN = 0.25; // 目標粗利率
const FEE_RATE = 0.1435; // eBay手数料

const TIERS = [20000, 50000, 100000];

interface RawItem {
  name?: string;
  buyJPY?: number;
  sellUSD?: number;
  grams?: number;
  note?: string;
}
interface OutItem {
  name: string;
  buyJPY: number;
  sellUSD: number;
  grams: number;
  shipJPY: number;
  marginPct: number;
  profitJPY: number;
  note: string;
}

function extractJson(text: string): { tiers?: { budget?: number; items?: RawItem[] }[] } | null {
  const matches = text.match(/\{[\s\S]*\}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(matches[i]);
      if (o && Array.isArray(o.tiers)) return o;
    } catch {
      // 次候補
    }
  }
  return null;
}

/** サーバー側で粗利を統一計算し、25%以上のものだけ残す */
function computeTier(items: RawItem[], budget: number, rate: number): OutItem[] {
  const out: OutItem[] = [];
  for (const it of items) {
    const name = String(it.name ?? "").trim();
    const buyJPY = Number(it.buyJPY) || 0;
    const sellUSD = Number(it.sellUSD) || 0;
    const grams = Number(it.grams) || 300;
    if (!name || buyJPY <= 0 || sellUSD <= 0) continue;
    if (buyJPY > budget) continue; // 予算超過は除外
    const revenueJPY = sellUSD * rate;
    const feeJPY = revenueJPY * FEE_RATE + 0.3 * rate;
    const shipJPY = estimateShippingJPY(grams);
    const bufferJPY = revenueJPY * BUFFER_RATE;
    const profit = revenueJPY - feeJPY - shipJPY - bufferJPY - buyJPY;
    const margin = revenueJPY > 0 ? profit / revenueJPY : 0;
    if (margin < MIN_MARGIN) continue;
    out.push({
      name,
      buyJPY: Math.round(buyJPY),
      sellUSD: Math.round(sellUSD * 100) / 100,
      grams,
      shipJPY: Math.round(shipJPY),
      marginPct: Math.round(margin * 1000) / 10,
      profitJPY: Math.round(profit),
      note: String(it.note ?? ""),
    });
  }
  // 粗利率の高い順
  return out.sort((a, b) => b.marginPct - a.marginPct);
}

async function runResearch() {
  const rate = await getUsdJpyRate();
  const client = new Anthropic({ maxRetries: 1 });

  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
    system:
      "あなたは日本からeBay(米国)へ輸出する物販セラーの仕入れリサーチャーです。" +
      "必ずWeb検索でeBay(ebay.com)の直近の売却済み(sold)価格と、" +
      "メルカリ(jp.mercari.com)・ヤフオク(auctions.yahoo.co.jp)の相場を調べてから回答してください。" +
      "記憶だけで価格を出してはいけません。実在し、直近で継続的に売れている商品だけを挙げてください。",
    messages: [
      {
        role: "user",
        content: `日本のメルカリ・ヤフオクで安く仕入れ、eBay(米国)で高く売れる商品を探し、仕入れ予算別に3段階でリスト化してください。

【条件】
- 直近でeBay(米国)で継続的に売れている実在の商品(型番・モデル名まで具体的に)
- 日本(メルカリ/ヤフオク)で仕入れ可能で、eBay売価との差が大きいもの
- カメラ/レンズ、腕時計、ゲーム機/ソフト、トレカ(ポケカ等)、フィギュア、オーディオ、楽器、ヴィンテージ衣類、日本限定品などが狙い目
- 各段階3〜6商品

【仕入れ予算の3段階】
- 予算 ≤ 20,000円
- 予算 ≤ 50,000円
- 予算 ≤ 100,000円

各商品について、次を数値で見積もってください:
- buyJPY: 日本での現実的な仕入れ額(円・予算内)
- sellUSD: eBay(米国)での直近の売却済み平均価格(USD)
- grams: 梱包前のおおよその重さ(g)
- note: 需要や状態の注意点を30字程度

※ 利益率はこちらで計算します(為替1USD=${rate.toFixed(
          1
        )}円、eBay手数料14.35%+$0.30、国際送料、売価5%の関税バッファを差し引き)。
そのため、送料や手数料を引いても粗利率30%以上を狙える価格差の大きい商品を選んでください。

最後に、必ず次の形式のJSONだけを1つ出力してください(前後の説明文は不要):
{"tiers":[
  {"budget":20000,"items":[{"name":"","buyJPY":0,"sellUSD":0,"grams":0,"note":""}]},
  {"budget":50000,"items":[...]},
  {"budget":100000,"items":[...]}
]}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text);
  if (!parsed?.tiers) {
    throw new Error("リサーチ結果を解析できませんでした。もう一度お試しください。");
  }

  const tiers = TIERS.map((budget) => {
    const raw = parsed.tiers!.find((t) => Number(t.budget) === budget);
    return {
      budget,
      items: computeTier(raw?.items ?? [], budget, rate),
    };
  });

  const result = {
    date: new Date().toISOString(),
    rate,
    minMargin: MIN_MARGIN,
    tiers,
  };
  await addSourcing(JSON.stringify(result));
  return result;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const runs = await listSourcing();
    const latest = runs[0] ? JSON.parse(runs[0].json) : null;
    return NextResponse.json({ latest, count: runs.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定のため仕入れリサーチは利用できません" },
      { status: 500 }
    );
  }
  try {
    const result = await runResearch();
    return NextResponse.json({ result });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const status = e.status ?? 500;
      let msg = `リサーチに失敗しました (${status})`;
      if (status === 401) msg = "APIキーが無効です。";
      else if (status === 400 && /credit|balance/i.test(e.message))
        msg = "Anthropicのクレジット残高が不足しています。";
      else if (status === 429) msg = "混雑しています。少し待って再度お試しください。";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
