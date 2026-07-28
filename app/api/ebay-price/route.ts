import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

interface PriceResult {
  found: boolean;
  avgUSD: number | null;
  lowUSD: number | null;
  highUSD: number | null;
  note: string;
}

/** Claudeの回答から最後のJSONオブジェクトを取り出す */
function extractJson(text: string): PriceResult | null {
  const matches = text.match(/\{[\s\S]*?\}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(matches[i]);
      if ("avgUSD" in o || "found" in o) return o as PriceResult;
    } catch {
      // 次の候補を試す
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定のため相場の自動取得は利用できません" },
      { status: 500 }
    );
  }

  try {
    const { name } = await req.json();
    const product = String(name ?? "").trim();
    if (!product) {
      return NextResponse.json({ error: "商品名がありません" }, { status: 400 });
    }

    const client = new Anthropic({ maxRetries: 1 });
    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      system:
        "あなたはeBay(米国)の相場調査アシスタントです。" +
        "必ずWeb検索でeBay(ebay.com)の実際の売却済み(sold/completed)価格を調べ、" +
        "米ドルの平均落札価格を算出してください。記憶だけで答えてはいけません。",
      messages: [
        {
          role: "user",
          content: `次の商品のeBay(米国)での売却済み(sold)平均価格を調べてください。

商品: ${product}

eBayのsold検索( https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
            product
          )}&LH_Sold=1&LH_Complete=1 )などを参考に、直近の実売価格帯を把握してください。

調査後、最後に必ず次の形式のJSONだけを1つ出力してください(前後に説明文は不要):
{"found": true/false, "avgUSD": 数値, "lowUSD": 数値, "highUSD": 数値, "note": "状態や補足を20字程度で"}

- found: 相場が分かった場合true、見つからなければfalse
- avgUSD: 中心的な売却価格(米ドル・数値のみ)
- lowUSD / highUSD: 実売価格帯の下限・上限
- 見つからない場合は avgUSD 等を null にしてください`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "相場を数値で取得できませんでした。手入力してください。" },
        { status: 502 }
      );
    }
    if (!parsed.found || parsed.avgUSD == null) {
      return NextResponse.json({
        found: false,
        note: parsed.note || "相場が見つかりませんでした",
      });
    }
    return NextResponse.json({
      found: true,
      avgUSD: parsed.avgUSD,
      lowUSD: parsed.lowUSD ?? null,
      highUSD: parsed.highUSD ?? null,
      note: parsed.note ?? "",
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const status = e.status ?? 500;
      let msg = `相場の取得に失敗しました (${status})`;
      if (status === 401) msg = "APIキーが無効です。";
      else if (status === 400 && /credit|balance/i.test(e.message))
        msg = "Anthropicのクレジット残高が不足しています。";
      else if (status === 429) msg = "混雑しています。少し待って再度お試しください。";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: `相場の取得に失敗しました: ${String(e)}` }, { status: 500 });
  }
}
