# syntax=docker/dockerfile:1
# プロダクション用マルチステージ Dockerfile（Issue #758）
#
# ステージ構成:
#   base    — Node ランタイム共通層（corepack で pnpm を有効化）
#   deps    — 全依存インストール（build / migrate が node_modules を共有）
#   build   — prisma generate + next build（standalone 出力）
#   migrate — Prisma CLI + schema + migrations のみの one-shot 用イメージ
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
# DATABASE_URL のダミー値: prisma.config.ts が config ロード時に env() を即時解決
# するため未設定だと prisma generate が落ちる。generate / next build は DB へ
# 接続しないため値はプレースホルダで良い（秘密情報は焼き込まない）。
# RUN 内のみで渡し、イメージの ENV には残さない
RUN DATABASE_URL="postgresql://build:build@build-placeholder:5432/build" \
    pnpm db:generate && \
    DATABASE_URL="postgresql://build:build@build-placeholder:5432/build" \
    pnpm build

# --- migrate: one-shot マイグレーション用 ----------------------------------
# standalone ランタイムには Prisma CLI が入らないため専用ステージを設ける。
# CMD は node_modules/.bin を直接叩く（corepack 経由の pnpm はコンテナ実行時に
# ネットワークダウンロードが走りうるため使わない）
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma/migrations prisma/migrations
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
