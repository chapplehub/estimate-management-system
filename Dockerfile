# syntax=docker/dockerfile:1
# プロダクション用マルチステージ Dockerfile（Issue #758）
#
# ステージ構成:
#   base    — Node ランタイム共通層（corepack で pnpm を有効化）
#   deps    — 全依存インストール（build / migrate が node_modules を共有）
#   build   — prisma generate + next build（standalone 出力）
#   migrate — Prisma CLI + schema/migrations + seed 一式の one-shot 用イメージ
#   runner  — standalone 成果物のみの実行イメージ（非 root）
#
# 前提:
#   - ビルド時に DB へ接続しない（CI ビルドの前提。秘密情報も焼き込まない）
#   - DATABASE_URL 等は実行時に compose の env で注入する
#   - Prisma は Rust エンジンレス構成のため slim イメージで OpenSSL 問題を踏まない

# .nvmrc（24.18.1）と一致させる。更新は Renovate の PR で意図的に取り込む
ARG NODE_VERSION=24.18.1

FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
# corepack が package.json の packageManager に従い pnpm をピン留めダウンロードする
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# --- deps: 全依存インストール ---------------------------------------------
FROM base AS deps
# CI=true で husky の prepare（.husky/install.mjs）を no-op にする
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .husky/install.mjs .husky/install.mjs
RUN pnpm install --frozen-lockfile

# --- build: prisma generate + next build（standalone） ---------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ビルド時ダミー env（値・理由とも .github/workflows/ci.yml の build ジョブと揃える）:
#   DATABASE_URL       — prisma.config.ts が config ロード時に env() を即時解決する
#                        ため未設定だと prisma generate が落ちる。ホストは RFC 2606 の
#                        .invalid にして「宣言された到達不能」にする（ベアラベルだと
#                        search domain 次第で解決され、NXDOMAIN が接続ハングに変わる）
#   BETTER_AUTH_*      — betterAuth() がモジュールスコープで実行され、secret 不在時の
#                        挙動（警告か throw か）が better-auth のバージョン依存のため
# generate / next build は DB にも認証基盤にも接続しないため値はプレースホルダで良い。
# RUN 内のみで渡し、イメージの ENV には残さない（秘密情報を焼き込まない）
RUN DATABASE_URL="postgresql://build:build@db-unreachable.invalid:5432/build_check" \
    BETTER_AUTH_SECRET="build-time-placeholder" \
    BETTER_AUTH_URL="http://localhost:3000" \
    pnpm db:generate && \
    DATABASE_URL="postgresql://build:build@db-unreachable.invalid:5432/build_check" \
    BETTER_AUTH_SECRET="build-time-placeholder" \
    BETTER_AUTH_URL="http://localhost:3000" \
    pnpm build

# --- migrate: one-shot マイグレーション + seed 用 ---------------------------
# standalone ランタイムには Prisma CLI が入らないため専用ステージを設ける。
# CMD は node_modules/.bin を直接叩く（corepack 経由の pnpm はコンテナ実行時に
# ネットワークダウンロードが走りうるため使わない）
#
# 公開デモ環境の初期データ投入（ADR-20260821-4f1）でもこのステージを使い、compose 側で
# command を tsx prisma/seed-dev.ts に上書きして呼ぶ。3 つ目のイメージは作らない。理由:
# deps が --prod なしで全依存を入れているためこのステージは既に dev 依存込みの
# node_modules（tsx を含む）を持っており、seed 用の追加分は数 MB に過ぎない。専用ステージ
# にしても中身がほぼ同一のイメージ・タグ・*_IMAGE 変数が増えるだけになる。
#
# seed 実行に必要なもの:
#   prisma/        — seed 本体と seed-dev-data / seed-shared。ファイル単位のピンポイント
#                    COPY は tsx が実行時にモジュールを解決する都合上、漏れても docker
#                    build にも CI にも引っかからず実行時に MODULE_NOT_FOUND で落ちる
#   src/           — seed が参照する共有ユーティリティとドメイン層（同上の理由で丸ごと）
#   tsconfig.json  — tsx が @server/* / @subdomains/* の paths を解決するのに要る
#   generated/     — .dockerignore で除外されるため下の RUN でこのステージ内で生成する。
#                    build ステージから COPY しないのは、migrate イメージのビルドを
#                    next build の成否に結合させないため（このステージは deps にのみ依存）
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
# ダミー DATABASE_URL の値と理由は build ステージと同じ。RUN 内のみで渡しイメージには残さない
RUN DATABASE_URL="postgresql://build:build@db-unreachable.invalid:5432/build_check" \
    node_modules/.bin/prisma generate
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# --- runner: 実行イメージ（standalone 成果物のみ・非 root） -----------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
