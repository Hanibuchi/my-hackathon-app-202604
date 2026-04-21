# GeoMind Companion

感情を幾何学的な図形で表現する **AI 目標達成コンパニオンアプリ**。

日々の進捗を AI と対話しながら記録し、目標達成をサポートします。

---

## 主な機能

- **目標・タスク管理** — 目標（例: 筋トレで体重+5kg）を設定し、日々のサブタスクへ分割
- **AI タスク提案** — 目標と期間をもとに Claude が実行可能なサブタスクを 5 つ自動提案
- **感情ジオメトリ** — AI の感情状態（positive / logical / encouraging）を幾何学的な図形でリアルタイム表現
- **会話型記録** — 今日の達成具合を AI に話すだけで、要約・数値・コメントを自動記録
- **カレンダー振り返り** — 過去の記録を日付・達成度・会話要約で確認

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | HTML / CSS / Vanilla JS (シングルファイル) |
| バックエンド | Node.js + Express / Python |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| AI SDK | `@anthropic-ai/sdk` |

---

## セットアップ

### 前提条件

- Node.js 18 以上
- Anthropic API キー（[console.anthropic.com](https://console.anthropic.com) で取得）

### 手順

```bash
# 1. リポジトリをクローン
git clone <repo-url>
cd my-hackathon-app-202604

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
cp .env.exaple .env
# .env を開いて ANTHROPIC_API_KEY に自分の API キーを貼り付ける。なければデモモードに。

# 4. サーバーを起動
npm start
```

ブラウザで `http://localhost:3000` を開いてください。

### Windows の場合（start.bat）

```
start.bat をダブルクリック
```

※ `.env` ファイルが存在しない場合は自動でエラー表示されます。

---

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `ANTHROPIC_API_KEY` | Anthropic API キー（必須） | — |
| `PORT` | サーバーのポート番号 | `3000` |

---

## API エンドポイント

### `POST /api/chat`

AI と会話し、進捗を記録する。

**リクエスト**
```json
{
  "message": "今日は腕立て 120 回できました！",
  "goals": [{ "name": "筋トレ", "days": 30, "progress": 40 }],
  "history": []
}
```

**レスポンス**
```json
{
  "text": "素晴らしい！目標を超えましたね。",
  "mood": "positive",
  "summary": "腕立て120回達成",
  "value": 120
}
```

### `POST /api/breakdown`

目標をサブタスクへ分割する。

**リクエスト**
```json
{
  "goal": "体重を 5kg 増やす",
  "category": "筋トレ",
  "deadline": "3 ヶ月"
}
```

**レスポンス**
```json
{
  "subtasks": ["毎日腕立て 100 回", "週 3 回スクワット", ...],
  "advice": "継続が力なり！"
}
```

---

## ディレクトリ構成

```
my-hackathon-app-202604/
├── geo_mind_companion_app.html  # フロントエンド（シングルファイル）
├── server.js                    # Node.js サーバー
├── server.py                    # Python サーバー
├── package.json
├── start.bat                    # Windows 用起動スクリプト
└── .env.exaple                  # 環境変数テンプレート
```

---

## ライセンス

MIT
