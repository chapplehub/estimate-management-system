# WSL2環境でのPlaywright並列実行時のディスクI/Oボトルネック

作成日: 2026-04-13

## 概要

WSL2環境でPlaywright E2Eテストを並列実行すると、CPU・メモリに余裕があってもディスクI/Oが100%に達してテストがタイムアウトする問題が発生した。`workers: 2` でも再現し、`workers: 1` でようやく安定した。

## 原因

### WSL2のディスクI/O構造

```
通常のLinux:   アプリ → ext4 → 物理SSD
WSL2:          アプリ → ext4 → ext4.vhdx(仮想ディスク) → NTFS → 物理SSD
```

WSL2はHyper-V上の軽量VMであり、全てのファイル操作が仮想ディスクイメージ(ext4.vhdx)を経由する。このVHDX経由のランダムI/Oはネイティブ Linux の3-5倍遅いとされる。

### Turbopack dev serverのオンデマンドコンパイル

Next.js の dev server (Turbopack) は各ページの初回アクセス時にオンデマンドでコンパイルを実行する。1ページのコンパイルで数百ファイルの読み込みと書き込みが発生するため、複数ワーカーが同時に異なるページにアクセスすると大量のランダムI/Oが同時発生する。

```
Worker 1: GET /products/new     → Turbopack: ファイル200個読み込み → コンパイル → 書き込み
Worker 2: GET /departments/new  → Turbopack: ファイル150個読み込み → コンパイル → 書き込み
                                  ↑ 同時に大量のランダムread/writeが発生 → VHDX帯域飽和
```

### sparseVhd=true の影響

`.wslconfig` の `sparseVhd=true` は未使用領域を動的に割り当てるため、書き込み時にブロック確保のオーバーヘッドが追加される可能性がある。

## 検証結果

環境: `.wslconfig` で memory=12GB, processors=12, swap=4GB を設定

| workers | テスト数 | 結果 | 所要時間 |
|---------|---------|------|---------|
| 6 (デフォルト) | 100 | 14件失敗（タイムアウト） | - |
| 3 | 100 | 1件失敗 + 2件中断（Ctrl+Cで停止） | 1.8分 |
| 2 | 100 | 2件失敗 + Ctrl+Cで停止 | - |
| 1 | 100 | 全件パス | 2.0分 |

失敗パターンはすべてタイムアウト (`page.goto` や `toBeVisible` の timeout 超過)。特定のテストが壊れているわけではなく、ディスクI/O飽和によるレスポンス遅延が原因。

## 対策

### 採用: workers: 1（ローカル）

```typescript
// playwright.config.ts
workers: process.env.CI ? 1 : 1,
```

100テスト/2分で十分実用的なため、ローカルでも `workers: 1` を採用。

### 将来的な改善候補

| 対策 | 効果 | 備考 |
|------|------|------|
| production build でテスト実行 | 事前コンパイル済みのためI/O負荷が大幅減少。並列化可能になる可能性 | webServer の command を `pnpm build && pnpm start` に変更 |
| sparseVhd=true を無効化 | 書き込みオーバーヘッドの軽減 | VHDXサイズが増加する |
| WSL2 → ネイティブLinux | I/Oボトルネック解消 | 環境変更が大きい |

## 補足: process.env.CI

`process.env.CI` は GitHub Actions が自動的にセットする環境変数。ローカルの `.env` で管理しているものではない。`playwright.config.ts` で CI 環境かローカル環境かを判定するために使用している。

## 参考

- 関連ファイル: `playwright.config.ts`
- 関連設定: `~/.wslconfig`
