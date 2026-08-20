# Issue #763: 計画からの逸脱記録

## 1. `docker/login-action` ステップの追加

- **元の計画内容**: Step 1 のステップ列は `actions/checkout` → `docker/setup-buildx-action` → `docker/metadata-action` → `docker/build-push-action` ×2（login は列挙されていなかった）
- **実際の実装内容**: `setup-buildx` の直後に `docker/login-action@v4.6.0` で `GITHUB_TOKEN` による ghcr.io ログインを追加した
- **逸脱の理由**: `permissions: packages: write` はトークンに権限を与えるだけで、push にはレジストリへのログインが別途必要。計画のステップ列の記載漏れであり、設計判断の変更ではない

## 2. `provenance: false` の明示

- **元の計画内容**: `docker/build-push-action` のオプションとして言及なし
- **実際の実装内容**: 両ビルドステップに `provenance: false` を指定した
- **逸脱の理由**: `build-push-action` v6 以降の既定は provenance attestation を付与し、単一アーキでもマニフェストリスト化される（GHCR UI に `unknown/unknown` の偽アーキ行が並ぶ既知の混乱要因）。単一アーキの素朴なマニフェストに保つ方が「arm64 単一」という ADR-20260818-7pn の決定を素直に反映する
