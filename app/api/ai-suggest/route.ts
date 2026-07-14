import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { addSuggestion, listItems } from "@/lib/sheets";
import { notify } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Web検索を含むため長めに確保

function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runSuggestion(): Promise<{ title: string; body: string }> {
  const client = new Anthropic();

  let inventoryNote = "(在庫情報なし)";
  try {
    const items = await listItems();
    const active = items.filter((i) => i.status === "在庫" || i.status === "出品中");
    if (active.length > 0) {
      inventoryNote = active
        .slice(0, 50)
        .map((i) => `- ${i.name} ($${i.priceUSD} / 仕入 ¥${i.costJPY})`)
        .join("\n");
    }
  } catch {
    // 在庫が読めなくても提案自体は実行する
  }

  const prompt = `あなたは日本からeBayで商品を販売するセラーのアドバイザーです。
Web検索を使って、今週のeBay市場動向を調査し、日本のセラーにとって「今売れる・仕入れるべき」商品カテゴリやトレンドを提案してください。

調査してほしい観点:
1. 現在eBayで需要が高い日本発の商品ジャンル(例: カメラ、トレカ、フィギュア、時計、ゲーム、伝統工芸品など)
2. 直近のトレンドや季節要因(イベント、新作リリース、コレクターの動きなど)
3. 具体的なおすすめ仕入れ商品を3〜5個(想定販売価格USDと理由付き)
4. 現在の在庫についてのアドバイス(値付け・売り時など)

現在の在庫:
${inventoryNote}

出力は日本語で、スマホでも読みやすいように簡潔な箇条書き中心でまとめてください。全体で800字程度。`;

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 8 },
    ],
    messages: [{ role: "user", content: prompt }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const date = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
  return { title: `${date} の市場提案`, body: text };
}

async function handle(): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定のためAI提案は利用できません" },
      { status: 500 }
    );
  }
  const { title, body } = await runSuggestion();
  await addSuggestion({
    date: new Date().toISOString(),
    title,
    body,
  });
  await notify(
    "💡 今週のAI市場サジェスチョン",
    "新しい販売提案が届きました。アプリで確認してください。",
    ["owner", "wife"],
    "/owner/suggestions"
  );
  return NextResponse.json({ ok: true, title });
}

// Vercel Cron からの週次実行
export async function GET(req: NextRequest) {
  if (!isCronRequest(req) && !isAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return await handle();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 画面の「今すぐ実行」ボタンから
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return await handle();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
