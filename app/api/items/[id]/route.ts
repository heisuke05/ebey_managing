import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { isAuthed } from "@/lib/auth";
import { getItem, updateItem, deleteItem, addLog, getSettings } from "@/lib/sheets";
import { notify } from "@/lib/push";
import { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 商品に紐づくBlobストアの写真を削除(残骸防止・失敗は無視) */
async function deletePhotos(item: Item): Promise<void> {
  const urls = [item.imageUrl, ...item.images].filter(Boolean);
  const pathnames = urls
    .map((u) => {
      const m = u.match(/[?&]pathname=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    })
    .filter((p): p is string => !!p);
  await Promise.all(
    pathnames.map((p) => del(p).catch(() => {}))
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const [item, settings] = await Promise.all([
      getItem(id),
      getSettings().catch(() => ({}) as Record<string, string>),
    ]);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item, settings });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const { who, ...patch } = body;
    const item = await updateItem(id, patch);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    const label = patch.status ? `ステータス→${patch.status}` : "情報更新";
    await addLog(who ?? "", item.id, item.name, label);

    // ステータス変更に応じてプッシュ通知
    if (patch.status === "梱包依頼") {
      await notify(
        "📦 梱包・発送のお願い",
        `「${item.name}」の梱包と発送をお願いします`,
        ["father", "mother", "wife"],
        "/family"
      );
    } else if (patch.status === "発送済み") {
      await notify(
        "✅ 発送完了",
        `「${item.name}」が発送されました${who ? `(担当: ${who})` : ""}`,
        ["owner", "wife"],
        "/owner"
      );
    } else if (patch.status === "売れた") {
      await notify(
        "🎉 商品が売れました",
        `「${item.name}」が購入されました`,
        ["owner", "wife"],
        "/owner"
      );
    }

    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const who = req.nextUrl.searchParams.get("who") ?? "";
    const item = await deleteItem(id);
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deletePhotos(item);
    await addLog(who, item.id, item.name, "商品削除");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
