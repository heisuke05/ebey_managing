import { google, sheets_v4 } from "googleapis";
import { Item, ItemStatus, Suggestion } from "./types";

const SHEET_ID = process.env.SHEET_ID ?? "";

const ITEMS_TAB = "在庫";
const SUBS_TAB = "通知登録";
const AI_TAB = "AI提案";
const LOG_TAB = "作業ログ";
const SETTINGS_TAB = "設定";

const ITEM_HEADERS = [
  "id",
  "商品名",
  "商品画像URL",
  "商品リンク",
  "販売価格",
  "仕入れ値JPY",
  "送料JPY",
  "ステータス",
  "保管場所",
  "追跡番号",
  "海外発送",
  "宛名",
  "宛先住所",
  "宛先国",
  "内容品",
  "メモ",
  "登録日",
  "更新日",
  "通貨",
  "追加画像",
];

let cachedClient: sheets_v4.Sheets | null = null;

function client(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!email || !key || !SHEET_ID) {
    throw new Error(
      "Google Sheets未設定: SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY を環境変数に設定してください"
    );
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

/** 必要なタブが無ければ作成しヘッダーを書き込む */
export async function ensureSetup(): Promise<void> {
  const api = client();
  const meta = await api.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );
  const wanted: [string, string[]][] = [
    [ITEMS_TAB, ITEM_HEADERS],
    [SUBS_TAB, ["endpoint", "p256dh", "auth", "role", "name", "登録日"]],
    [AI_TAB, ["日付", "タイトル", "内容"]],
    [LOG_TAB, ["日時", "担当", "商品ID", "商品名", "操作"]],
    [SETTINGS_TAB, ["キー", "値"]],
  ];
  const missing = wanted.filter(([name]) => !existing.has(name));

  if (missing.length > 0) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: missing.map(([name]) => ({
          addSheet: { properties: { title: name } },
        })),
      },
    });
  }

  // 在庫タブのヘッダーは列追加に備えて常に最新へ同期
  if (existing.has(ITEMS_TAB)) {
    await api.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${ITEMS_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [ITEM_HEADERS] },
    });
  }
  if (missing.length === 0) return;
  for (const [name, headers] of missing) {
    await api.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${name}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    if (name === SETTINGS_TAB) {
      await api.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SETTINGS_TAB}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            ["差出人名(ローマ字)", ""],
            ["差出人住所(英語表記)", ""],
            ["差出人電話", ""],
            ["eBay手数料率", "0.1435"],
          ],
        },
      });
    }
  }
}

async function readTab(tab: string): Promise<string[][]> {
  const api = client();
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1:Z10000`,
  });
  return (res.data.values as string[][]) ?? [];
}

function rowToItem(row: string[]): Item {
  const get = (i: number) => row[i] ?? "";
  return {
    id: get(0),
    name: get(1),
    imageUrl: get(2),
    listingUrl: get(3),
    price: parseFloat(get(4)) || 0,
    costJPY: parseFloat(get(5)) || 0,
    shippingJPY: parseFloat(get(6)) || 0,
    status: (get(7) || "在庫") as ItemStatus,
    location: get(8),
    tracking: get(9),
    intl: get(10) === "TRUE" || get(10) === "○",
    buyerName: get(11),
    buyerAddress: get(12),
    buyerCountry: get(13),
    contents: get(14),
    note: get(15),
    createdAt: get(16),
    updatedAt: get(17),
    currency: get(18) === "JPY" ? "JPY" : "USD",
    images: get(19) ? get(19).split("\n").filter(Boolean) : [],
  };
}

function itemToRow(item: Item): string[] {
  return [
    item.id,
    item.name,
    item.imageUrl,
    item.listingUrl,
    String(item.price),
    String(item.costJPY),
    String(item.shippingJPY),
    item.status,
    item.location,
    item.tracking,
    item.intl ? "TRUE" : "FALSE",
    item.buyerName,
    item.buyerAddress,
    item.buyerCountry,
    item.contents,
    item.note,
    item.createdAt,
    item.updatedAt,
    item.currency,
    item.images.join("\n"),
  ];
}

export async function listItems(): Promise<Item[]> {
  const rows = await readTab(ITEMS_TAB);
  return rows.slice(1).filter((r) => r[0]).map(rowToItem);
}

export async function getItem(id: string): Promise<Item | null> {
  const items = await listItems();
  return items.find((i) => i.id === id) ?? null;
}

export async function createItem(
  data: Partial<Item> & { name: string }
): Promise<Item> {
  const now = new Date().toISOString();
  const item: Item = {
    id: `it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: data.name,
    imageUrl: data.imageUrl ?? "",
    images: data.images ?? [],
    listingUrl: data.listingUrl ?? "",
    price: data.price ?? 0,
    currency: data.currency ?? "USD",
    costJPY: data.costJPY ?? 0,
    shippingJPY: data.shippingJPY ?? 0,
    status: data.status ?? "在庫",
    location: data.location ?? "",
    tracking: data.tracking ?? "",
    intl: data.intl ?? false,
    buyerName: data.buyerName ?? "",
    buyerAddress: data.buyerAddress ?? "",
    buyerCountry: data.buyerCountry ?? "",
    contents: data.contents ?? "",
    note: data.note ?? "",
    createdAt: now,
    updatedAt: now,
  };
  await client().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${ITEMS_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [itemToRow(item)] },
  });
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Item>
): Promise<Item | null> {
  const rows = await readTab(ITEMS_TAB);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx < 0) return null;
  const updated: Item = {
    ...rowToItem(rows[idx]),
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  await client().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${ITEMS_TAB}!A${idx + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [itemToRow(updated)] },
  });
  return updated;
}

/** 指定タブの数値シートIDを取得(行削除に必要) */
async function tabSheetId(title: string): Promise<number | null> {
  const meta = await client().spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = (meta.data.sheets ?? []).find(
    (s) => s.properties?.title === title
  );
  return sheet?.properties?.sheetId ?? null;
}

/** 商品をシートから完全に削除する。削除した商品を返す(見つからなければnull) */
export async function deleteItem(id: string): Promise<Item | null> {
  const rows = await readTab(ITEMS_TAB);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (idx < 0) return null;
  const item = rowToItem(rows[idx]);

  const sheetId = await tabSheetId(ITEMS_TAB);
  if (sheetId == null) return null;

  await client().spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: idx, // 0起点(ヘッダー行が0なので実データ行と一致)
              endIndex: idx + 1,
            },
          },
        },
      ],
    },
  });
  return item;
}

// ---- プッシュ通知の購読情報 ----

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  role: string;
  name: string;
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const rows = await readTab(SUBS_TAB);
  return rows
    .slice(1)
    .filter((r) => r[0])
    .map((r) => ({
      endpoint: r[0],
      p256dh: r[1] ?? "",
      auth: r[2] ?? "",
      role: r[3] ?? "",
      name: r[4] ?? "",
    }));
}

export async function addSubscription(sub: StoredSubscription): Promise<void> {
  const existing = await listSubscriptions();
  if (existing.some((s) => s.endpoint === sub.endpoint)) return;
  await client().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SUBS_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [sub.endpoint, sub.p256dh, sub.auth, sub.role, sub.name, new Date().toISOString()],
      ],
    },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const rows = await readTab(SUBS_TAB);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === endpoint);
  if (idx < 0) return;
  await client().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SUBS_TAB}!A${idx + 1}:F${idx + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", ""]] },
  });
}

// ---- AI提案 ----

export async function addSuggestion(s: Suggestion): Promise<void> {
  await client().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${AI_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[s.date, s.title, s.body]] },
  });
}

export async function listSuggestions(): Promise<Suggestion[]> {
  const rows = await readTab(AI_TAB);
  return rows
    .slice(1)
    .filter((r) => r[0])
    .map((r) => ({ date: r[0], title: r[1] ?? "", body: r[2] ?? "" }))
    .reverse();
}

// ---- 作業ログ ----

export async function addLog(
  who: string,
  itemId: string,
  itemName: string,
  action: string
): Promise<void> {
  try {
    await client().spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${LOG_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[new Date().toISOString(), who, itemId, itemName, action]],
      },
    });
  } catch {
    // ログ失敗で本処理を止めない
  }
}

// ---- 設定 ----

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await readTab(SETTINGS_TAB);
  const out: Record<string, string> = {};
  for (const r of rows.slice(1)) {
    if (r[0]) out[r[0]] = r[1] ?? "";
  }
  return out;
}
