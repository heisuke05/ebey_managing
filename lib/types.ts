export type ItemStatus = "在庫" | "出品中" | "売れた" | "梱包依頼" | "発送済み";

export const STATUSES: ItemStatus[] = ["在庫", "出品中", "売れた", "梱包依頼", "発送済み"];

export interface Item {
  id: string;
  name: string;
  imageUrl: string;
  listingUrl: string;
  priceUSD: number; // 販売価格 (USD)
  costJPY: number; // 仕入れ値 (円)
  shippingJPY: number; // 送料見込み (円)
  status: ItemStatus;
  location: string; // 保管場所
  tracking: string; // 追跡番号
  intl: boolean; // 海外発送
  buyerName: string;
  buyerAddress: string;
  buyerCountry: string;
  contents: string; // 内容品(税関申告用)
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Suggestion {
  date: string;
  title: string;
  body: string;
}

export type Role = "owner" | "wife" | "father" | "mother";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "オーナー",
  wife: "妻",
  father: "父",
  mother: "母",
};
