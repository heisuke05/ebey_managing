import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

const COOKIE_NAME = "fam_auth";

function expectedToken(): string {
  const pass = process.env.FAMILY_PASSCODE ?? "";
  return createHmac("sha256", "ebey-managing-v1").update(pass).digest("hex");
}

export function makeToken(passcode: string): string | null {
  const expected = process.env.FAMILY_PASSCODE ?? "";
  if (!expected) return null;
  const a = Buffer.from(passcode);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return expectedToken();
}

export function isAuthed(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return !!token && token === expectedToken();
}

export const AUTH_COOKIE = COOKIE_NAME;
