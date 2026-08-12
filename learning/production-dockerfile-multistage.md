# プロダクション用マルチステージ Dockerfile の読み解き

作成日: 2026-08-08

## 概要

Issue #758 で導入したプロダクション用 Dockerfile（base / deps / build / migrate / runner の 5 ステージ）を 1 ステージずつ読み解いた。個々の行の意図だけでなく、corepack の動作タイミング、ネイティブバイナリの配布機構と pnpm の allowBuilds、one-shot マイグレーションパターン、compose の起動チェーンまで、構成全体を貫く設計原則を整理した。

## 詳細

### ステージ構成と依存グラフ

```
                    base（node:24.18.1-slim + corepack/pnpm）
                   /                                  \
        deps（pnpm install 全依存）                     \
        /                        \                      \
  build（generate + next build）   migrate ステージ        \
       |                              |                   |
  runner ステージ ←───────────────────┼───────────────────┘
                                      |
   [ems-app:local]              [ems-migrate:local]
```

`--target` 指定で必要なステージだけが実行される。base ステージ自体は最終イメージに含まれず、共通設定の重複排除とレイヤーキャッシュ共有のための抽象レイヤー。

### base ステージ

- `ARG NODE_VERSION=24.18.1` は `.nvmrc` と一致させる運用。Renovate PR で意図的に更新
- `slim`（Debian ベース軽量版）で足りるのは **Prisma がエンジンレス構成**（`engineType = "client"`、純 TS 実装）だから。従来の Rust クエリエンジンは OpenSSL に動的リンクしており slim/alpine で環境不一致問題を踏みがちだった
- `corepack enable` は **shim を置くだけ**。pnpm 本体のダウンロードは最初に `pnpm` コマンドを実行した瞬間（= deps ステージの `pnpm install` 時）に起きる
- `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` は corepack 0.20+ の初回ダウンロード確認プロンプト対策。Docker ビルドは非対話なので、これがないとエラーまたはハング。pnpm 公式ドキュメントの Dockerfile 例にないのは、プロンプト導入（2023 年末）前の例が更新されていないため。アプローチ自体（corepack 方式）は公式と同じ
- 公式例にある `PNPM_HOME`/`PATH` はグローバルインストール用。このプロジェクトは使わないので省略

### deps ステージ

- 依存定義 4 ファイル（package.json / pnpm-lock.yaml / pnpm-workspace.yaml / .husky/install.mjs）**だけ**を COPY してから `pnpm install --frozen-lockfile`。ソース変更で依存再インストールが走らないようにするレイヤーキャッシュの定石
- `ENV CI=true` で husky の prepare（`.husky/install.mjs` が `NODE_ENV === "production" || CI === "true"` で早期 exit）を no-op 化。コンテナに `.git` がないため husky install は失敗する
- **`NODE_ENV=production` をあえて設定しない**のが重要。pnpm は `NODE_ENV=production` だと `--prod` 相当になり devDependencies をスキップするため、build ステージが壊れる。husky 抑止に CI=true の方を使ったのは「同じ目的を達成できる 2 つの環境変数のうち副作用のない方を選ぶ」判断
- devDependencies を削らないのは、build ステージで必要 & runner は node_modules を一切コピーしないため削る意味がないから

### ネイティブバイナリと allowBuilds（pnpm-workspace.yaml）

ネイティブバイナリ = 特定の OS × CPU 向けにコンパイル済みの機械語実行ファイル。動的リンクで OS の共有ライブラリ（glibc / OpenSSL）に依存する。配布方式は 2 つ:

1. **postinstall スクリプト方式**: インストール後に JS スクリプトが環境検出してバイナリをダウンロード。例: `@prisma/engines`（`schema-engine-debian-openssl-3.0.x`、22MB の ELF を取得）、esbuild、unrs-resolver
2. **プラットフォーム別 optionalDependencies 方式**: 全プラットフォーム分のサブパッケージを列挙し、合致する 1 つだけがインストールされる。例: sharp（`@img/sharp-linux-x64` のみ入る）。こちらが新しい主流

pnpm v10+ はサプライチェーン攻撃対策で**依存のライフサイクルスクリプトをデフォルト実行しない**。`allowBuilds` は明示的な許可リスト（このリポジトリでは @prisma/engines / esbuild / prisma / sharp / unrs-resolver の 5 つ）。許可がないと警告付きでインストール自体は成功し、**実行時に「バイナリがない」エラーで時間差で壊れる**。同ファイルの `minimumReleaseAge: 4320`（3 日クールダウン）も同じサプライチェーン防御の一環。

.dockerignore が node_modules を除外するのは、バイナリが「インストールした環境」依存だから。コンテナ内で入れ直すことで Debian slim に合ったバイナリが保証される。

### build ステージ

- `.dockerignore` により `.env*` は原理的にイメージに入らない。`generated` / `.next` も除外してイメージ内で必ず再生成
- **ダミー DATABASE_URL** が必要な理由: `prisma.config.ts` の `env("DATABASE_URL")` が config ロード時に即時解決されるため、未設定だと `prisma generate` が起動すら失敗。generate / next build は DB に接続しないので値はプレースホルダで良い
- `ENV` ではなく `RUN VAR=value cmd` 形式で渡すことで、イメージのメタデータに残さない（衛生習慣の一貫）
- ホスト名 `build-placeholder` は実在しない名前。万一ビルド中に接続が試みられたら DNS 解決で即失敗し違反が顕在化する防御的命名
- ダミー URL 方式が成立するのは全ページ動的レンダリングだから。SSG で DB を読むページがあれば build 中に落ちる（アーキテクチャ前提が Dockerfile に埋め込まれている）
- `output: "standalone"` により Node File Trace で実行に必要なファイルだけを集めた `.next/standalone/` が生成される

### migrate ステージ

- 存在理由: standalone には Prisma CLI（と schema-engine バイナリ）が入らない。runner に足すと肥大化 & 本番アプリコンテナにスキーマ変更能力を常備することになる
- `migrate deploy` は適用専用・冪等。`_prisma_migrations` テーブルと突き合わせて未適用分だけ実行
- COPY は最小セット（node_modules / package.json / prisma.config.ts / schema.prisma / migrations）。**アプリコードは 1 行も入らない**
- ダミー DATABASE_URL は不要: `env("DATABASE_URL")` の評価はコンテナ実行時で、そのとき compose が本物を注入している
- CMD が `node_modules/.bin/prisma` 直叩きなのは、`pnpm prisma` だと**コンテナ実行時に corepack のネットワークダウンロードが走りうる**ため。本番起動パスにレジストリ依存を持ち込まない
- **エンジンレスはクライアントだけの話**: マイグレーション用の schema-engine は今も Rust ネイティブバイナリ（`debian-openssl-3.0.x`）。base を alpine に変えると runner は無傷でも migrate だけ壊れる

### runner ステージ

- `HOSTNAME=0.0.0.0` は **Docker が注入する同名変数を打ち消すための必須設定**（2026-08-12 検証・下記「HOSTNAME 衝突」参照）。「これがないと localhost にバインドされる」ではない
- standalone は意図的に `.next/static` と `public/` を**含まない**（Vercel では CDN が配信する前提）。セルフホストでは手動コピーが必須。忘れると「HTML は返るが CSS/JS が全部 404」という特徴的な壊れ方
- `COPY --chown=node:node` の理由: COPY はデフォルト root 所有。Next.js は `.next/cache/` に書き込むため node 所有が必要。後から `RUN chown -R` するとレイヤー二重記録でイメージサイズ倍増
- `EXPOSE 3000` はドキュメンテーション専用（公開効果なし)。実際の公開は nginx の 80/443 のみ
- `CMD ["node", "server.js"]` — next CLI 不要の自己完結起動
- healthcheck が node の fetch なのは curl/wget がイメージにないため

### HOSTNAME 衝突（`ENV HOSTNAME=0.0.0.0` が必要な本当の理由）

Next.js の standalone サーバーが読む `HOSTNAME` と、Docker がコンテナに注入する `HOSTNAME` は**同名だが意味が違う**。どちらもバグではなく、環境変数というグローバル名前空間での衝突。

| | `HOSTNAME` に込めた意味 |
| --- | --- |
| Docker | コンテナの**識別名**（`hostname` コマンドと同じ値を env でも提供する UNIX 慣習） |
| Next.js | サーバーが**bind する宛先アドレス** |

- Next.js 16.2.12 の standalone テンプレート（`node_modules/next/dist/build/utils.js:1088`）は `const hostname = process.env.HOSTNAME || '0.0.0.0'`。**既定値自体は `0.0.0.0`** なので「設定しないと localhost になる」は誤り
- 問題は左辺。Docker はコンテナ起動時に `HOSTNAME=<コンテナID>`（例 `668488c0a748`）を env に入れる（`docker exec ... env | grep HOSTNAME` で確認可）
- そのため `ENV` で潰さないと Next.js は `"668488c0a748"` を bind 先として受け取る。この名前は Docker が書いた `/etc/hosts` の自己エントリ（`172.21.0.2  668488c0a748`）で**解決に成功してしまう**ため、起動もログも正常に見えたまま **eth0 の IP にだけ bind** される
- 結果: nginx からの `proxy_pass http://app:3000`（eth0 宛）は通るが、healthcheck の `fetch('http://localhost:3000/api/health')` は 127.0.0.1 で listen していないため必ず失敗 → app が healthy にならず → `condition: service_healthy` を満たせず **nginx が永久に起動しない**
- 解決に失敗していれば即クラッシュして原因が一目で分かったはず。`/etc/hosts` の自己エントリが安全弁を無効化し、「失敗が別の妥当な動作に化ける」タイプの罠になっている

補足:

- **`0.0.0.0` は「全世界に公開」ではない**。境界を作るのは bind アドレスではなくネットワークネームスペース。app には `ports:` がないのでホスト外からの経路自体が存在しない。lo と eth0 の両方で待つ必要があるのは、healthcheck（lo）と nginx（eth0）の**両経路が必須**だから
- **env の上書きは Docker 側に影響しない**。ホスト名の真実の源は UTS ネームスペース。`-e HOSTNAME=0.0.0.0` を渡しても `hostname` コマンド / `/etc/hostname` / `/etc/hosts` / 他コンテナからの DNS 解決はコンテナ ID のまま（検証済み）。env はあくまでコピー。bash の `$HOSTNAME` は自身が `gethostname(2)` で取るシェル変数なのでこれも別経路
- **将来の注意**: APM / ログ収集エージェントを同梱すると、それらが `HOSTNAME` env をインスタンス識別子として読み「全台 0.0.0.0」になりうる。k8s へ移す場合は `HOSTNAME` = Pod 名を潰すことになるため、`ENV` を外して manifest 側で bind アドレスを渡す方式への切り替えを検討する
- 同種の衝突は `PORT`（`utils.js:1087` で同様に読む）や `NODE_ENV` にもある。runner ステージが 3 つまとめて `ENV` で固定しているのは、**実行基盤が注入しうる汎用名の変数を自分の管理下に置く**という意思表示

### COPY のコピー元の正確な理解

- `--from` なし COPY のコピー元は**ビルドコンテキスト**（`docker build` の最後の引数で指定、.dockerignore フィルタ済み tar としてデーモンに送られる）。Dockerfile 内の `WORKDIR` はコピー**先**の相対パス解決にしか関与しない
- `--from=<stage>` 付き COPY はそのステージのルートファイルシステム基準。だから `/app/node_modules` と絶対パスで書く
- コンテキスト外（`../` など）は参照不可能（セキュリティ境界）
- .dockerignore は秘密の除外に加え、巨大ディレクトリの転送時間削減の役割もある

### compose 起動チェーン（compose.prod.yaml）

```
db 起動 → healthy（pg_isready）
  → migrate 実行（one-shot、restart: "no"）→ exit 0（service_completed_successfully）
    → app 起動 → healthy（/api/health が 200）
      → nginx 起動（80/443 で外部公開）
```

- migrate はサーバーではなく**ジョブ**。正常終了自体が「スキーマは最新」のシグナルとして app の起動条件になる。失敗すれば app は起動せず、古いスキーマで新コードが動く事故を構造的に防ぐ
- app 起動時 entrypoint で migrate する素朴な方式と違い、スケールアウト時にマイグレーションが競合しない
- 秘密情報は `--env-file .env.production` で実行時にのみ注入

### 貫かれている 3 つの設計原則

1. **ビルドと実行の分離** — ビルド時は DB 接続なし・秘密なし。実行時に compose が注入。だから CI ビルドのイメージをどの環境にも配れる
2. **実行時の外部依存排除** — pnpm/corepack を実行時に経由しない、`next start` でなく素の node、healthcheck は同梱 node の fetch
3. **最小権限・最小内容** — 両イメージ非 root。migrate は「スキーマを変えられるがアプリを動かせない」、runner は「アプリを動かせるがスキーマを変えられない」の相互排他。両者の共有点は deps の node_modules だけなので、CLI とクライアントの Prisma バージョンが構造的に一致する

## 参考

- 関連ファイル: `Dockerfile`, `compose.prod.yaml`, `.dockerignore`, `pnpm-workspace.yaml`, `prisma.config.ts`, `prisma/schema.prisma`, `.husky/install.mjs`, `next.config.ts`（`output: "standalone"`）
- 関連メモ: [compose-image-vs-build-and-registry-flow.md](./compose-image-vs-build-and-registry-flow.md)（`image:` / `build:` の役割分担とレジストリ配布フロー）
- Issue #758（プロダクション Docker 構成）
- pnpm 公式 Docker ドキュメント: https://pnpm.io/docker
- Next.js standalone output（static/public の手動コピー要件）: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
