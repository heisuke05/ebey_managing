import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Privateブロブの写真を、ログイン済みの家族にだけ配信する */
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return new NextResponse("unauthorized", { status: 401 });

  const pathname = req.nextUrl.searchParams.get("pathname");
  if (!pathname || !pathname.startsWith("items/")) {
    return new NextResponse("bad request", { status: 400 });
  }

  try {
    const result = await get(pathname, {
      access: "private",
      ifNoneMatch: req.headers.get("if-none-match") ?? undefined,
    });
    if (!result) return new NextResponse("not found", { status: 404 });

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
    if (result.statusCode !== 200 || !result.stream) {
      return new NextResponse("not found", { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "X-Content-Type-Options": "nosniff",
        ETag: result.blob.etag,
        // ファイル名は毎回ユニークなので長めにキャッシュしてよい
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch (e) {
    return new NextResponse(`error: ${String(e)}`, { status: 500 });
  }
}
