import { Item } from "./types";

let cachedRate: { value: number; at: number } | null = null;

/** USD/JPY レートを取得(1時間キャッシュ)。失敗時は直近値か150を返す */
export async function getUsdJpyRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.at < 60 * 60 * 1000) {
    return cachedRate.value;
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const rate = data?.rates?.JPY;
    if (typeof rate === "number" && rate > 0) {
      cachedRate = { value: rate, at: Date.now() };
      return rate;
    }
  } catch {
    // fall through
  }
  return cachedRate?.value ?? 150;
}

export interface ProfitBreakdown {
  revenueJPY: number;
  feeJPY: number;
  profitJPY: number;
  rate: number;
}

/** eBay手数料(既定14.35% + $0.30/件)を差し引いた想定純利益 */
export function calcProfit(
  item: Pick<Item, "priceUSD" | "costJPY" | "shippingJPY">,
  rate: number,
  feeRate = 0.1435
): ProfitBreakdown {
  const revenueJPY = item.priceUSD * rate;
  const feeJPY = (item.priceUSD * feeRate + 0.3) * rate;
  const profitJPY = revenueJPY - feeJPY - item.costJPY - item.shippingJPY;
  return {
    revenueJPY: Math.round(revenueJPY),
    feeJPY: Math.round(feeJPY),
    profitJPY: Math.round(profitJPY),
    rate,
  };
}
