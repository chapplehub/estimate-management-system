# ADR-0041: 見積複製系譜表(EstimateVariationCopy)のキーをサロゲートidではなく自然キー(copiedVariationId)にする

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-11 |
| 最終更新日 | 2026-06-11 |

## コンテキスト

`EstimateVariationCopy` は「複製先バリエーション(`copiedVariationId`) → 複製元バリエーション(`sourceVariationId`)」を記録する関連テーブルである。当初スキーマはドメイン生成 UUIDv7 のサロゲート `id` を主キーに持ち、`copiedVariationId` を `@unique` としていた。

しかしこの関連は**非対称**である：

1. **一意性が片側だけ**にある（`copiedVariationId @unique` / `sourceVariationId` は重複可。1 複製元は何度でも複製できる）。
2. **関数従属** `copiedVariationId → sourceVariationId` が成立し、`copiedVariationId` 単独が候補キー。
3. **ライフサイクル**も複製先に従属（`copiedVariation` への `onDelete: Cascade`、複製元へは参照のみ）。

つまり本質は「複製先バリエーションの出自ポインタ」を NULL 排除のため別テーブルへ抽出したもので、対称な多対多リンクではない。他のエンティティ表はドメイン生成 UUIDv7 のサロゲート id で統一している（[ADR-0009](0009-migrate-id-generation-from-cuid2-to-uuidv7.md)）。

## 検討した選択肢

### A. サロゲート id を削除し `copiedVariationId` を主キーにする（採用）

ドメインでは系譜を独自 identity を持たない**値オブジェクト** `{ copiedVariationId, sourceVariationId }` として表現する。`insertWithCopies` は書き込むだけで集約へ再構築しないため、行の identity を必要としない。

### B. サロゲート id を維持する（不採用）

他テーブルとの見た目の一貫性は保てるが、`copiedVariationId` 単独が候補キーである以上サロゲートは冗長。kawasima 決定木・スキーマの NULL 排除方針（不要な列を増やさない）に反する。

## 決定

A を採用する。`EstimateVariationCopy` のサロゲート `id` 列を削除し、`copiedVariationId` を主キーとする。ドメインでは値オブジェクトとして表現する。

## 根拠

純粋な関連（交差）テーブルであり、複製先が完全な自然キー（immutable・unique・ドメイン生成済み）を成す。非対称な主従構造（一意性・関数従属・cascade がすべて複製先側に偏る）を主キーがそのまま語る。他のエンティティ表と見た目の一貫性は崩れるが、これは関連テーブルの性質上むしろ自然キーが適切である。

## 影響

- 系譜はドメインで独自 identity を持たない値オブジェクトとなり、id 生成規約（各エンティティの `Id.generate()`）の対象外となる。
- 同型の `EstimateVariationRevision`（得意先改訂の系譜）も同じ非対称性を持つが、自然キー化は得意先改訂を扱う C7 で別途判断する（本 issue では複製系譜のみ変更）。
- スキーマ変更（主キー差し替えのマイグレーション）を伴う。
