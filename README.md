# 歌ノート

カラオケで歌う曲・歌いたい曲を管理する個人用 PWA です。

## 役割分担

| 用途 | 使うもの |
|------|----------|
| **日常利用（歌う・曲を探す）** | **Safari** → [https://takeshimonoseki.github.io/karaoke/](https://takeshimonoseki.github.io/karaoke/) → ホーム画面に追加 |
| **開発・修正の指示** | Cursor（Mac または iPhone アプリ）→ リポジトリ `takeshimonoseki/karaoke` |
| **一時確認のみ** | `npm run serve:local` / `npm run serve:iphone`（本番ではない） |

Cursor の iPhone アプリは **AIエージェント操作用** です。歌ノート本体は開きません。

## 機能

- 歌える曲 / 歌いたい曲の2リスト管理
- 歌唱履歴・お気に入り・キー・メモ
- 年代×ジャンル×性別のランキング検索
- 約8万曲のローカルマスター検索
- 端末内の自動バックアップ（最大5世代）
- 手動 JSON バックアップ / 復元
- オフライン対応（PWA）
- 設定からキャッシュクリア＆再読み込み

## iPhone で使う（本番）

1. **古いホーム画面アイコンを削除**（Cloudflare / `.local` URL のものは無効）
2. Safari で [https://takeshimonoseki.github.io/karaoke/](https://takeshimonoseki.github.io/karaoke/) を開く
3. 設定（•••）下部が **歌ノート v1.0.4** であることを確認
4. 共有 → **ホーム画面に追加**
5. 画面がおかしい・ボタンが効かないときは設定 → **キャッシュをクリアして再読み込み**

データは iPhone 内に保存されます。Mac のサーバーは不要です。

### iPhone 確認チェック（〜390px）

- [ ] 歌手フィルタ（両方 / 男性 / 女性）が1行に収まる
- [ ] 曲カードで「▶ YT」と「＋ 追加」が横並びで両方タップできる
- [ ] 「歌える曲」バッジがタイトルに重ならない
- [ ] 設定にバージョンとインストール案内が表示される

## 開発

```bash
# 依存インストール不要（Node のみ）

# データ品質チェック
npm run verify:data

# ローカル HTTPS サーバー（開発用）
npm run setup:local   # 初回のみ
npm run serve:local

# 静的ビルド
npm run build:static
```

## Cursor（iPhone / Mac）での修正の流れ

1. リポジトリ `takeshimonoseki/karaoke` を選ぶ
2. 「検索UIを直して」「verify:data を通して」など指示
3. 差分確認 → push / マージ
4. **実機確認は Safari の Pages URL で行う**

## データ更新

```bash
npm run build:master    # iTunes API から extra 再生成
npm run refresh:data    # ジャンル再タグ + 性別 + 検証
```

## バックアップ

- **自動**: 曲データの変更時に端末内 IndexedDB へ最大5世代保存
- **手動**: 設定 → バックアップを書き出す（機種変更時に使用）
- **復元**: 設定 → 自動バックアップから復元 / バックアップを読み込む

## デプロイ（GitHub Pages）

`main` ブランチへ push すると GitHub Actions が自動デプロイします。

初回は GitHub リポジトリの **Settings → Pages → Branch: `gh-pages` / `/ (root)`** を選んでください。

## ライセンス

個人利用プロジェクト
