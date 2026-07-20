// eBay Browse API(現在の出品=アクティブ相場)を取得する。
// 売り切れ(sold)データはeBay公式が制限しているため、そちらは
// buildSoldSearchUrl() が返すURLをブラウザで開いて確認する運用にする。

const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const MARKETPLACE = "EBAY_US"; // 米国バイヤー向けの相場

let cachedToken: { value: string; expiresAt: number } | null = null;

function creds(): { id: string; secret: string } | null {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

export function ebayConfigured(): boolean {
  return creds() !== null;
}

async function getToken(): Promise<string | null> {
  const c = creds();
  if (!c) return null;
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const basic = Buffer.from(`${c.id}:${c.secret}`).toString("base64");
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`eBay認証に失敗しました (${res.status})`);
  }
  const data = await res.json();
  const token = data.access_token as string;
  const ttl = (data.expires_in as number) ?? 7200;
  cachedToken = { value: token, expiresAt: Date.now() + (ttl - 300) * 1000 };
  return token;
}

export interface ActiveMarket {
  count: number; // 出品総数
  sampled: number; // 相場計算に使った件数
  min: number;
  avg: number;
  max: number;
  currency: string;
  topConditions: { name: string; count: number }[];
}

async function browse(params: string): Promise<ActiveMarket | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(`${BROWSE_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`eBay検索に失敗しました (${res.status})`);
  }
  const data = await res.json();
  const summaries: unknown[] = data.itemSummaries ?? [];
  const prices: number[] = [];
  let currency = "USD";
  const condCount: Record<string, number> = {};
  for (const s of summaries as Record<string, unknown>[]) {
    const price = s.price as { value?: string; currency?: string } | undefined;
    const v = price?.value ? parseFloat(price.value) : NaN;
    if (!isNaN(v)) {
      prices.push(v);
      if (price?.currency) currency = price.currency;
    }
    const cond = (s.condition as string) || "不明";
    condCount[cond] = (condCount[cond] ?? 0) + 1;
  }
  const total = (data.total as number) ?? summaries.length;
  if (prices.length === 0) {
    return {
      count: total,
      sampled: 0,
      min: 0,
      avg: 0,
      max: 0,
      currency,
      topConditions: [],
    };
  }
  const sum = prices.reduce((a, b) => a + b, 0);
  const topConditions = Object.entries(condCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
  return {
    count: total,
    sampled: prices.length,
    min: Math.min(...prices),
    avg: Math.round((sum / prices.length) * 100) / 100,
    max: Math.max(...prices),
    currency,
    topConditions,
  };
}

/** GTIN(バーコード)優先で検索し、無ければキーワードで再検索 */
export async function searchActiveMarket(
  keyword: string,
  gtin?: string
): Promise<ActiveMarket | null> {
  if (gtin) {
    const byGtin = await browse(`gtin=${encodeURIComponent(gtin)}&limit=100`);
    if (byGtin && byGtin.count > 0) return byGtin;
  }
  if (!keyword.trim()) return null;
  return browse(`q=${encodeURIComponent(keyword)}&limit=100&filter=buyingOptions:{FIXED_PRICE}`);
}

/** eBayの「売り切れ(Sold/Completed)」検索ページのURLを組み立てる */
export function buildSoldSearchUrl(keyword: string): string {
  const q = encodeURIComponent(keyword.trim());
  // LH_Sold=1 & LH_Complete=1 で売り切れ品、_sop=13 で終了日の新しい順
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=13`;
}
