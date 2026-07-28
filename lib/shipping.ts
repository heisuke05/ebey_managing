// 商品カテゴリから重さの目安を出し、日本→米国の国際送料を概算する。
// あくまで概算(国際eパケット/EMS相当)。実際の料金は発送方法で変わるため
// 画面上で編集できるようにしている。

export interface WeightPreset {
  label: string;
  grams: number;
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  { label: "小物・アクセサリー", grams: 100 },
  { label: "ゲーム・トレカ", grams: 150 },
  { label: "腕時計", grams: 250 },
  { label: "本・雑誌", grams: 400 },
  { label: "フィギュア", grams: 500 },
  { label: "衣類", grams: 500 },
  { label: "カメラ・レンズ", grams: 800 },
  { label: "家電・大型", grams: 1500 },
];

/**
 * 商品の重さ(g)から日本→米国の国際送料(円)を概算する。
 * 梱包材ぶん(約150g)を加味。2kg以下はeパケット相当、超過はEMS相当。
 */
export function estimateShippingJPY(itemGrams: number): number {
  const g = Math.max(0, itemGrams) + 150; // 梱包材込み
  if (g <= 0) return 0;
  if (g <= 2000) {
    // 国際eパケット相当の概算(追跡付き・2kgまで)
    return Math.round(700 + Math.ceil(g / 100) * 120);
  }
  // EMS相当(2kg超)
  const kgOver = Math.ceil((g - 2000) / 1000);
  return 3600 + kgOver * 1200;
}
