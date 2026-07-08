# Issue #574 auto-review-fix ラウンド1 修正計画

## 対象指摘（judge 採用・いずれも ①correctness）

| バケツ | severity(参考) | file:line | 問題 |
|---|---|---|---|
| ①correctness | High | `page.tsx:28-30` | `Number()` が int32 超の整数文字列（例 `"9999999999"`）を通し、Prisma `Int`(int4) 列への where で throw → `error.tsx` 不在のため `notFound()`(404) でなく **500** |
| ①correctness | Low | `page.tsx:28-30` | `Number()` が非正規10進文字列（`"0x1"`/`"1.0"`/`" 1"`/`"+1"`）を受理し bogus URL が 404 でなく **200** 描画 |

両者は「`variationNumber` 入力バリデーションの緩さ」という単一原因。1コミットで両方解消する。

## 修正方針

`page.tsx` の `variationNumber` パースブロックを差し替える:

```ts
// Before
const variationNumberValue = Number(variationNumber);
if (!Number.isInteger(variationNumberValue)) {
  notFound();
}

// After
// URL セグメントは常に文字列。厳格な10進整数（先頭ゼロ/符号/小数/16進/空白を弾く）かつ
// int4 範囲内のみ受理し、それ以外は notFound()。範囲外・非正規を Prisma に到達させないことで
// 500 を避け、業務範囲外（存在しない番号）は既存のクエリ null → notFound に委ねる。
const variationNumberValue = Number(variationNumber);
if (
  !/^[1-9][0-9]*$/.test(variationNumber) ||
  variationNumberValue > 2_147_483_647
) {
  notFound();
}
```

- `/^[1-9][0-9]*$/`: 1始まりの正の10進整数のみ受理（`0`・先頭ゼロ・`0x1`・`1.0`・`+1`・` 1` を全て弾く）→ 指摘B解消。
- `> 2_147_483_647`（int4 上限）超を弾く → Prisma に範囲外値を渡さない → 指摘A解消。
- 業務上の上限（1〜99）はパース層で二重に持たず、存在しない番号はクエリ null → `notFound()` の既存設計に委ねる（DB/ドメイン制約の変更でパース層が乖離するのを防ぐ）。

## 影響範囲

- `page.tsx` のパースブロックのみ。BE クエリ（#573）・コンポーネント・DTO には触れない。
- 既存の正常系（`/N9905015/1` 等）は挙動不変。

## 想定テスト

- `pnpm test`（既存単体は本箇所に依存しないが緑を確認）。
- `pnpm lint`。
- E2E（NotFound シナリオ）は既存の「存在しない見積番号 → 404」で担保済み。パースの範囲/正規性は入力早期棄却の局所修正であり、E2E 追加は本ラウンドのスコープ外（残課題として報告）。

## DDD 層配置

- 入力バリデーション（URL セグメントの数値正規化・範囲）は presentation 層（RSC page.tsx）の責務。BE クエリを変更しないため層違反なし。
