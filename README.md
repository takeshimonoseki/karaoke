# 歌ノート

カラオケで歌う曲・歌いたい曲を管理する個人用 PWA です。

## 機能

- 歌える曲 / 歌いたい曲の2リスト管理
- 歌唱履歴・お気に入り・キー・メモ
- 年代×ジャンル×性別のランキング検索
- 約8万曲のローカルマスター検索
- 端末内の自動バックアップ（最大5世代）
- 手動 JSON バックアップ / 復元
- オフライン対応（PWA）

## iPhone で使う

1. Safari でアプリの URL を開く
2. 初回は曲データの読み込み完了まで待つ（1〜2分）
3. 共有 → **ホーム画面に追加**

データは iPhone 内に保存されます。Mac のサーバーは不要です。

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
