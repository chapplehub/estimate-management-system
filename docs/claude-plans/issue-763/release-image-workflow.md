# Issue #763: 本番イメージを GitHub Actions でビルドし GHCR へ push するワークフローを整備する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

`Dockerfile` の `runner` / `migrate` ステージを GitHub Actions でビルドし、GHCR（`ghcr.io/chapplehub/estimate-management-system/{app,migrate}`）へ `latest` + `sha-<short>` の二重タグで push するワークフロー `.github/workflows/release-image.yml` を新設する。あわせて、main をリリースブランチとして稼働させるための周辺整備（`protect-main` の required checks 追加、#761 への決定書き戻し）と、初回リリース時の手動作業（GHCR パッケージの public 化）を行う。

/grill-with-docs セッション（2026-08-18）で全設計判断を合意済み。

## 設計判断

いずれも /grill-with-docs で合意済み。ここでは結論と理由の要点のみ記録する。

### CPU アーキテクチャ
- A. x86_64 単一 / B. arm64 単一 / C. multi-arch
- 採用: **B. arm64 単一**（`ubuntu-24.04-arm` ネイティブビルド、EC2 は Graviton 前提）
- 理由: public リポジトリでは arm64 ランナーが無料でクロスビルドの懸念が消え、Graviton の EC2 費用減（10〜20%）だけが残るため。詳細は **ADR-20260818-7pn**（起票済み）

### トリガーと `latest` の発行元
- 採用: **`main` への push**（+ `workflow_dispatch`）。`latest` は main から発行し、リリースは develop → main の PR マージで行う
- 理由: Git Flow 準拠（main = 本番の写像）。デプロイ元ブランチと開発ブランチを分ける実務的運用を意図的に採用（ユーザーの明示的な意向）。`workflow_dispatch` が main 以外の ref から起動された場合に push しないガードを入れる（「latest = main の写像」の不変条件保護）

### GHCR パッケージの可視性
- 採用: **public**（EC2 側の `docker login` / PAT 運用は持たない）
- 理由: リポジトリ自体が public でソースは公開済み、イメージに秘密情報は焼き込まれていない（Dockerfile の設計で担保済み）。private は PAT 配置・更新という純コストのみ

### 既存 `ci.yml` との関係
- 採用: **独立ワークフロー新設**（`ci.yml` と並走、`next build` の二重実行を許容）
- 理由: `ci.yml` は「`pnpm install` を実行する run に書き込みトークンを置かない」設計原則を持つ（ci.yml:38-44）。独立ワークフローなら `packages: write` を持つ run でランナー上の `pnpm install` が発生しない（依存インストールは docker build の内側のみ）

### レイヤキャッシュ戦略
- 採用: **run をまたぐ外部キャッシュなし**。1 job 内で `runner` → `migrate` を順次ビルドし、同一 builder のローカルキャッシュで `deps` ステージを 1 回に抑える
- 理由: キャッシュキーの実体は `pnpm-lock.yaml` だが Renovate の高頻度更新でリリース間ヒット率が低い。GHA Cache は 7 日で消え、レジストリキャッシュは毎回数百 MB の転送が逆ザヤ。必要になれば `cache-from/to: type=registry` を後付けできる

### #761（EC2 上ビルドへの暗黙フォールバック）の解決方針
- 採用: **`compose.prod.yaml` から `build:` セクションを削除**（`pull_policy: always` は不採用）。**実施は #761 側**で行い、本イシューでは決定の書き戻しのみ
- 理由: 経路そのものの削除が構造的に確実。`pull_policy: always` は GHCR 障害時に起動不能という新しい障害モードを持ち込む。ローカル検証は既に明示的 `docker build` + `APP_IMAGE`/`MIGRATE_IMAGE` 指定で成立しており `build:` に依存していない

### 古いイメージの保持方針
- 採用: **SHA タグは無制限に残す**（刈り込み機構は作らない）
- 理由: public パッケージはストレージ無料でコスト圧力がなく、リリース頻度も低い。刈り込みは削除ワークフローという可動部品と誤削除リスクだけを持ち込む。全 SHA 残存 = main 全履歴がロールバック可能という最強の保証がタダで手に入る

### リリースゲート
- 採用: **`protect-main` ルールセットの required checks に `e2e report` を追加**し、develop と同一の 3 チェック体制（`static` / `test` / `e2e report`）にする
- 理由: 現状は本番リリース PR のゲートが develop への日常マージより緩いという逆転がある。playwright.yml は既にリリース PR で実行されるため追加実行コストはゼロ

## ステップ

### Step 1: release-image.yml の新設
- [ ] **完了**
- 対象ファイル: `.github/workflows/release-image.yml`
- テスト戦略: テスト不要（CI 設定ファイル。検証は develop → main の初回リリース push での実 run で行う）
- 作業内容:
  - トリガー: `push: branches: [main]` + `workflow_dispatch`
  - `workflow_dispatch` ガード: job レベルの `if:` で `github.ref == 'refs/heads/main'` 以外では実行しない（develop から手動起動されて `latest` が汚れるのを防ぐ）
  - ランナー: `ubuntu-24.04-arm`（arm64 ネイティブ。ADR-20260818-7pn）
  - `permissions: contents: read` + `packages: write`（ランナー上で `pnpm install` を実行しないため書き込みトークンと同居してよい。ci.yml の権限分離原則と整合）
  - `concurrency`: `group: ${{ github.workflow }}-${{ github.ref }}`、`cancel-in-progress: false`（push 済みイメージの順序を保ち、`latest` が常に最新 run の成果になるようキューイング）
  - steps: `actions/checkout` → `docker/setup-buildx-action`（builder 1 個）→ `docker/metadata-action` でタグ生成（`latest` + `sha-<short>`）→ `docker/build-push-action` を `target: runner` → `target: migrate` の順に 2 回実行（同一 builder のローカルキャッシュで `base`/`deps` ステージを共有し `pnpm install` を 1 回に抑える）
  - イメージ名は compose の既定参照に一致させる: `ghcr.io/chapplehub/estimate-management-system/app` / `.../migrate`
  - 外部キャッシュ（`cache-from`/`cache-to`）は設定しない
  - 既存ワークフローの流儀に合わせる: action バージョンのピン留め粒度、設計理由のコメント記載（ci.yml / playwright.yml 準拠）
- コミットメッセージ: `ci: 本番イメージを GHCR へ push する release-image ワークフローを追加する`

### Step 2: protect-main ルールセットに e2e report を追加
- [ ] **完了**
- 対象ファイル: なし（GitHub リポジトリ設定。ruleset id 12978605）
- テスト戦略: テスト不要（GitHub 設定変更。`gh api` で設定後に GET で反映を確認する）
- 作業内容:
  - `gh api -X PUT repos/chapplehub/estimate-management-system/rulesets/12978605` で required_status_checks に `e2e report` を追加し、`static` / `test` / `e2e report` の 3 チェック体制にする（既存の rules・conditions は維持したまま required_status_checks のみ差し替え）
  - 反映後、GET で develop 側（12978563）と同一の required checks になっていることを確認
- コミットメッセージ: なし（リポジトリ設定変更のみ。ファイル変更を伴わない）

### Step 3: #761 への決定書き戻し
- [ ] **完了**
- 対象ファイル: なし（GitHub Issue コメント）
- テスト戦略: テスト不要（Issue 運用作業）
- 作業内容:
  - #761 に本セッションの決定をコメント: 解決方針は `build:` セクションの削除（`pull_policy: always` は不採用。理由: 経路の構造的削除が確実、always は GHCR 障害時の起動不能という新障害モードを持ち込む、ローカル検証は `build:` 非依存）。あわせて compose.prod.yaml 内の「ローカル検証では build で代替する」コメントの書き換えも #761 のスコープであることを明記
- コミットメッセージ: なし（Issue コメントのみ）

### Step 4: 初回リリース時の手動作業の文書化と実施
- [ ] **完了**
- 対象ファイル: なし（GHCR パッケージ設定。実施はマージ後・初回 main push 後）
- テスト戦略: テスト不要（レジストリ設定の手動作業）
- 作業内容:
  - 本 PR マージ → develop → main の初回リリース PR マージ → release-image.yml の初回 run 完了後に実施する（初回 push 時、GHCR パッケージは private がデフォルトのため）:
    - `app` / `migrate` 両パッケージの可視性を public に変更
    - パッケージとリポジトリのリンク（Actions からの push で自動リンクされる）を確認
    - EC2 想定の無認証 pull（`docker pull ghcr.io/chapplehub/estimate-management-system/app:latest`）が通ることを確認
  - この手順は PR 本文に「マージ後の作業」として記載し、忘れ防止とする
- コミットメッセージ: なし（レジストリ設定のみ）
