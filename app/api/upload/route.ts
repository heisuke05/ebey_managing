import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "10MB以下の画像にしてください" }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const blob = await put(`items/${Date.now()}.${ext}`, file, {
      access: "public",
      contentType: file.type || "image/jpeg",
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json(
      { error: `アップロード失敗: ${String(e)}` },
      { status: 500 }
    );
  }
}
