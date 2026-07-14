# eBay 家族管理アプリ

家族(オーナー・妻・父・母)で使う、eBay販売の在庫・発送管理アプリです。
データはGoogleスプレッドシートに保存されるので、シートからも閲覧・編集できます。

## 主な機能

| 機能 | 説明 |
|---|---|
| 👴👵 ご両親用画面 (`/family`) | 大きなボタンだけの簡単画面。「やること」が上に表示され、📷写真を撮る/✅発送完了 の2タップで完結 |
| 📣 梱包発送依頼の通知 | オーナーが「梱包発送を依頼」を押すと、父・母・妻のスマホにプッシュ通知が届く |
| 📦 在庫管理 (`/owner`) | 商品名・写真・リンク・価格・仕入れ値・保管場所・追跡番号・ステータス管理 |
| 💰 利益自動計算 | 為替レート自動取得 + eBay手数料(既定14.35%)を引いた想定純利益を表示 |
| ✈️ 海外発送ラベル (`/label/[id]`) | オーナーが宛先を入力 → 印刷用ラベル(税関申告欄付き)を表示・印刷 |
| 💡 AI市場サジェスチョン | 毎週月曜朝に Claude がWeb検索で市場を調査し、おすすめ仕入れ商品を提案(手動実行も可) |
| 📊 スプレッドシート連動 | 在庫・通知登録・AI提案・作業ログ・設定 の各タブを自動作成。売れたら在庫ステータスも自動連動 |

ステータスの流れ: **在庫 → 出品中 → 売れた → 梱包依頼 → 発送済み**

## セットアップ手順

### 1. Googleサービスアカウントを作る(シート連携用)

1. https://console.cloud.google.com/ で新しいプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→ **Google Sheets API** を有効化
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
4. 作成したサービスアカウント →「キー」→「鍵を追加」→ JSON をダウンロード
5. JSONの `client_email` を **GOOGLE_SERVICE_ACCOUNT_EMAIL**、`private_key` を **GOOGLE_PRIVATE_KEY** に設定
6. **管理用スプレッドシートを `client_email` のアドレスに「編集者」として共有**(これを忘れると動きません)

### 2. プッシュ通知の鍵を作る

```bash
npx web-push generate-vapid-keys
```

出力された Public Key → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`、Private Key → `VAPID_PRIVATE_KEY` に設定。

### 3. Vercelへデプロイ

1. このリポジトリを Vercel にインポート(**独立した新規プロジェクトとして**)
2. Storage → **Blob** を作成(写真保存用。`BLOB_READ_WRITE_TOKEN` が自動設定されます)
3. Settings → Environment Variables に `.env.example` の内容を設定
4. `CRON_SECRET` にランダムな文字列を設定すると、毎週月曜7時(JST)にAI提案が自動実行されます
5. `ANTHROPIC_API_KEY` を設定するとAI市場サジェスチョンが使えます

### 4. 家族のスマホに設定

1. デプロイURLをSafari/Chromeで開く
2. **ホーム画面に追加**(iPhoneは共有ボタン→「ホーム画面に追加」)
   - ⚠️ iPhoneは**ホーム画面に追加したアプリから開かないと通知が届きません**
3. 自分の名前をタップ →「あいことば」を入力 →「はじめる」
4. 通知の許可を求められたら「**許可**」を押す

## 画面と役割

| 役割 | 開く画面 | できること |
|---|---|---|
| 父・母 | `/family` | 写真を撮る、発送完了をタップ |
| オーナー・妻 | `/owner` | 在庫管理、梱包依頼、ラベル印刷、AI提案 |

## ローカル開発

```bash
npm install
cp .env.example .env.local  # 値を設定
npm run dev
```

## 技術構成

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- データベース: Google Sheets(googleapis / サービスアカウント認証)
- 写真: Vercel Blob / 通知: Web Push (VAPID) / AI: Claude API (claude-opus-4-8 + Web検索)
- 定期実行: Vercel Cron(`vercel.json` / 毎週月曜 7:00 JST)
