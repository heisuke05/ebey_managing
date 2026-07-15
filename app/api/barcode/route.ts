import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Lookup {
  name: string;
  imageUrl?: string;
}

/** ISBN(書籍)は Google Books で検索 */
async function lookupIsbn(code: string): Promise<Lookup | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const info = data?.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const authors = Array.isArray(info.authors) ? ` / ${info.authors.join(", ")}` : "";
  return {
    name: `${info.title}${authors}`,
    imageUrl: info.imageLinks?.thumbnail?.replace("http://", "https://"),
  };
}

/** 一般商品(JAN/UPC/EAN)は UPCitemdb(無料枠)で検索 */
async function lookupUpc(code: string): Promise<Lookup | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const item = data?.items?.[0];
  if (!item?.title) return null;
  return {
    name: item.title,
    imageUrl: Array.isArray(item.images) ? item.images[0] : undefined,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = req.nextUrl.searchParams.get("code")?.replace(/\D/g, "") ?? "";
  if (code.length < 8) {
    return NextResponse.json({ error: "バーコードを読み取れませんでした" }, { status: 400 });
  }
  try {
    const isIsbn = code.startsWith("978") || code.startsWith("979");
    let result = isIsbn ? await lookupIsbn(code) : await lookupUpc(code);
    // ISBNで見つからなければ一般DBも試す(逆も)
    if (!result) result = isIsbn ? await lookupUpc(code) : await lookupIsbn(code);
    if (!result) {
      return NextResponse.json(
        { error: `商品情報が見つかりませんでした(コード: ${code})。商品名は手入力してください。` },
        { status: 404 }
      );
    }
    return NextResponse.json({ code, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
