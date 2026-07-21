import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "@/lib/auth";
import { getUsdJpyRate } from "@/lib/profit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が未設定のためAI相場調査は利用できません" },
      { status: 500 }
    );
  }

  try {
    const { name, costJPY } = await req.json();
    const product = String(name ?? "").trim();
    if (!product) {
      return NextResponse.json({ error: "商品名がありません" }, { status: 400 });
    }

    const rate = await getUsdJpyRate();
    const costNote =
      costJPY && Number(costJPY) > 0
        ? `\n店頭価格(仕入れ候補): ${Number(costJPY).toLocaleString()}円 — この値段で買って利益が出るかを必ず判定してください。`
        : "";

    const client = new Anthropic({ maxRetries: 1 });
    const stream = client.messages.stream({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      system:
        "あなたは日本からeBay(米国)へ輸出販売するセラーの仕入れアドバイザーです。" +
        "回答は必ずWeb検索で実際の相場を調べてから作成してください。記憶だけで価格を答えてはいけません。" +
        "店舗の店頭でスマホで読む前提なので、簡潔に、結論から書いてください。",
      messages: [
        {
          role: "user",
          content: `次の商品をeBay(米国)で販売する場合の仕入れ判断をしてください。

商品: ${product}${costNote}

前提:
- 為替: 1USD = ${rate.toFixed(1)}円
- eBay手数料は約14.35%
- 日本からの国際送料は小型で2,000円前後、大型・重量物は5,000〜15,000円程度

必ずWeb検索でeBayの実際の売却価格(sold/completed)を調べた上で、以下の形式で簡潔に回答してください:

【結論】仕入れ推奨 / 要検討 / 見送り のいずれか + 一言理由

【売却相場】$◯◯〜$◯◯(中心価格 $◯◯ / 約◯◯円)

【売れ行き】活発 / 普通 / 低調 + 根拠を一言

【推奨仕入れ上限】◯◯円 ※手数料・送料を引いて利益が残る上限額

【注意点】
- (偽物リスク、バッテリー等の発送規制、状態による価格差、型番違いなど該当するもののみ2〜3点)

全体で400字程度に収めてください。`,
        },
      ],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json(
        { error: "AIが回答を生成できませんでした。もう一度お試しください。" },
        { status: 500 }
      );
    }
    return NextResponse.json({ text, rate });
  } catch (e) {
    // Vercelのログにも残す(Deployments → Logs で確認できる)
    console.error("ai-market failed:", e);

    // Anthropic APIのエラーは原因が分かる形で返す
    if (e instanceof Anthropic.APIError) {
      const status = e.status ?? 500;
      let msg = `AI相場調査に失敗しました (${status})`;
      if (status === 401) msg = "APIキーが無効です。Vercelの設定を確認してください。";
      else if (status === 400 && /credit|balance/i.test(e.message))
        msg = "Anthropicのクレジット残高が不足しています。チャージしてください。";
      else if (status === 404)
        msg = "指定のAIモデルが利用できません。設定を見直します。";
      else if (status === 429)
        msg = "リクエストが集中しています。少し待って再度お試しください。";
      else if (status >= 500)
        msg = "AIサービスが混雑しています。少し待って再度お試しください。";
      return NextResponse.json({ error: `${msg}\n詳細: ${e.message}` }, { status: 500 });
    }
    return NextResponse.json(
      { error: `AI相場調査に失敗しました。詳細: ${String(e)}` },
      { status: 500 }
    );
  }
}
