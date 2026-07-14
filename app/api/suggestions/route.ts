import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { listSuggestions } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const suggestions = await listSuggestions();
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
