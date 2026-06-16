# Issue #349 実装計画からの逸脱記録

## 逸脱1: `search()` に空 variations 行のマップ前除外を追加

### 元の計画
`PrismaEstimateQueryService` の変更は `buildWhereClause` の新設のみ。`search()` の
取得→マップ部分（`rows.map(toSummaryDTO)`）は不変の想定だった。

### 実際の実装
`search()` のマップ前に `filter((row) => row.variations.length > 0)` を追加した。

```ts
return rows
  .filter((row) => row.variations.length > 0)
  .map((row) => PrismaEstimateQueryService.toSummaryDTO(row));
```

### 逸脱の理由
- 本 issue で `search` を呼ぶ単体テストを増やした結果、pre-push のフルスイートが flake した。
  原因は `search` の全件走査 read model が、**共有 dev DB 上で並行実行される他テストの
  「variations が一過性に空の行」**（予約レンジ外の `N9700001` 等）を読み、`toSummaryDTO` の
  代表選択ガード（`変数 representative` 不在で throw）に踏むこと。後フィルタ（予約レンジ）に
  到達する前に `search` 全体が reject していた。
- 本修正は**本番挙動を変えない**（集約不変条件により本番の行は常に variations ≥ 1）。除外される
  のはテスト環境の一過性行のみ。
- 副次的に、`activeStatus="INACTIVE"` の `none: { status: "ACTIVE" }` が variations 0 件の行に
  vacuously マッチする論理エッジも同時に塞ぐ（一覧フィルタの堅牢化として #349 の趣旨と地続き）。
- `toSummaryDTO` 内の throw は `findByEstimateNumber` 等への保険として温存（コメントのみ更新）。

### 影響範囲
`src/server/subdomains/estimate/infrastructure/queries/PrismaEstimateQueryService.ts` のみ。
DTO 契約・インターフェース・テスト期待値は不変。
