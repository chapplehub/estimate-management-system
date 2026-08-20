---
name: verify-frontend
description: フロントエンドの変更を dev server + playwright MCP で実機確認する。Use when UIバグの再現・修正確認、画面表示やブラウザ動作の検証、「dev server 立てて確認」「この画面の修正が効いてるか見て」と言われたとき。ログイン情報・実在データの確認手順・ポート確認を含む。
user-invocable: true
---

# フロントエンド実機検証

UI の変更（バグ再現・修正確認・表示確認）を、dev server を起動して **playwright MCP** のブラウザで実機検証する手順。
ユニットテスト（`pnpm test`）や E2E（`pnpm e2e`）では捉えにくい「実ブラウザのコンソール警告・hydration エラー・見た目」を確認する用途。

## 前提・原則

- **コードを読んで推論しても断定できない症状（React の key 警告・hydration エラー等）は、実機で再現してから直す。** 推測で修正を撒かない。
- **dev DB は全 worktree 共有でドリフトしやすい。** 見積番号などの対象データを決め打ちしない。
- 検証用に起動した dev server は、検証後に停止する（後片付け）。

## 手順

### 1. playwright MCP ツールの準備

`ToolSearch` で必要なツールをロードする（初回のみ）。最低限：
`browser_navigate` / `browser_snapshot` / `browser_console_messages` / `browser_click` / `browser_fill_form`（または `browser_type`）/ `browser_close`

```
ToolSearch: select:mcp__playwright__browser_navigate,mcp__playwright__browser_console_messages,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_fill_form,mcp__playwright__browser_close
```

### 2. dev server 起動 & ポート確認

`pnpm dev` をバックグラウンド起動し、**起動ログで実際のポートを確認する**。

- 既定は `3000` だが、他 worktree の dev server が使用中だと `3001` 等へ自動でずれる。
- 起動ログの `- Local: http://localhost:XXXX` を必ず読み、以降の URL に使う。
- DB 接続や port bind のため、必要なら sandbox 無効化で起動する。

### 3. サインイン

playwright MCP で `http://localhost:<port>/signin` を開き、ログインする。

- 管理者: `employee1@example.com` / パスワード `pass123!`（seed の `DEFAULT_PASSWORD`・`EMP000001` 管理ユーザ）
- 一般ユーザー: `employee2@example.com` / 同パスワード（`EMP000002`）
- 認証は middleware/proxy で守られているため、未ログインのまま対象画面を開くと `/signin` にリダイレクトされる。

### 4. 対象データを一覧で確認してから遷移

**詳細画面の番号・ID を決め打ちしない。** 一覧画面で実在レコードを確認してから対象画面へ遷移する。

- 例: 見積詳細を見たい → まず `/estimates` を開き、一覧に出ている実在の見積番号（例 `N9905001`）を確認 → `/estimates/<実在番号>` へ。
- 存在しない ID を開くと `notFound()` で 404 になり、症状を見誤る。

### 5. コンソール・表示の確認

- `browser_console_messages`（`level: warning` 以上、必要なら `all: true`）で警告・エラーを確認する。
  - React の key 警告・hydration エラー等はここに出る。本番ビルドでは出ないため **dev mode（`pnpm dev`）で見る**こと。
- `browser_snapshot` で要素の表示・配置が正常か確認する（screenshot より構造が読める）。
- 必要に応じて `browser_click` / `browser_fill_form` で操作し、操作後の挙動・コンソールも確認する。

### 6. 修正 → 再確認

修正を適用したら、dev server のホットリロードを待って **同じ手順（4〜5）で再確認**する。
警告・エラーが消えたこと（`Errors: 0, Warnings: 0`）と、画面・操作が壊れていないことの両方を確認する。

### 7. 後片付け

- `browser_close` でブラウザを閉じる。
- 自分が起動した dev server を停止する（例: `fuser -k <port>/tcp`）。
  **他 worktree の dev server（別ポート）を巻き込まないよう、自分が使ったポートだけを止める。**

## チェックリスト

- [ ] 起動ログで実ポートを確認したか
- [ ] 既知のログイン情報でサインインしたか
- [ ] 対象データを一覧で実在確認してから遷移したか
- [ ] 修正前に症状を実機で再現したか
- [ ] 修正後に同手順で消失・無破壊を確認したか
- [ ] dev server を後片付けしたか（自分のポートのみ）
