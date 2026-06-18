# ADR-0056: 見積作成の税率導出＋整合チェックは CreateEstimateCommand に内包せず app-shared ラッパに置く

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-17 |
| 最終更新日 | 2026-06-17 |

## コンテキスト

見積新規作成画面（issue #351 / C1 UI）で、保存時に設計書 §8.7 の税率整合チェック（見積年月日の税率と締切日の税率が一致するか）を行い、不一致ならフォームエラーで警告する必要がある。

更新系コマンド（C2 `UpdateEstimate` / C3 `AddVariation` / C4 `UpdateVariation`）は、**コマンド自身が税率チェックを内包**する設計で確立している。`execute` は `TaxCheckedSaveResult`（`saved | taxRateMismatch` の判別共用体・ADR-0037/0038）を返し、内部で共通機構 `checkTaxRateThenSave`（既存集約を楽観ロック付き `update`・ADR-0039）を呼ぶ。

ところが作成系には、更新系と異なる 2 つの事情がある:

1. **作成は税率を「チェックするだけでなく導出もする」**。編集画面の税率は見積年月日から自動決定され read-only（`TaxRateRepository.findEffectiveAt`）。作成画面でも同様に導出する（§A.1）。§8.7 整合チェックは見積年月日の税率を既に解決しているので、その `consistent` 結果が返す単一 `rate` をそのまま採用税率に使える。つまり作成系の税率関心は「導出＋チェック」で、更新系の「チェックのみ」より一段仕事が多い。
2. **`CreateEstimateCommand` は他コマンドのテストフィクスチャとして多用されている**。ReviseForCustomer / AddVariation / UpdateVariation / UpdateEstimate の各テストが `new CreateEstimateCommand(...)` で前提見積を組み立て、`taxRate` を明示で渡し戻り値 `Estimate` を期待する。コマンドに税率チェックを内包させ戻り値を union に変えると、これらフィクスチャが一斉に壊れ、各所で税率サービスのモック注入＋union 分解が必要になる。

## 検討した選択肢

### A. CreateEstimateCommand に内包（更新系と完全対称・不採用）

`CreateEstimateCommand` に `TaxRateConsistencyCheckDomainService` を注入し、`execute` を `{ created | taxRateMismatch }` の union に変える。税率は内部で導出する。

- C2/C3/C4 と完全に同型（コマンドが税率関心を所有）。
- しかし作成コマンドをフィクスチャに使う既存テストが壊れる。`CreateEstimateCommand` が「純粋なアグリゲート組立器」でなくなり、テスト前提づくりが重くなる。

### B. app-shared ラッパ `checkTaxRateThenCreate`（採用）

`CreateEstimateCommand` は現状のまま（`taxRate` を受け取り `Estimate` を返す純粋な組立器）。新たに app-shared `checkTaxRateThenCreate` を設け、§8.7 チェック → `consistent` なら解決税率を `taxRate` に詰めてコマンドへ委譲 → `{ created | taxRateMismatch }` を返す。実画面の Server Action はこのラッパを使う。

```ts
// app/shared: 既存の checkTaxRateThenSave と同型の税率ヘルパ
const check = await deps.taxRateConsistencyCheck.check({
  estimateDate: input.estimateDate,
  deadline: input.deadline,
});
if (check.kind === "mismatch") {
  return { kind: "taxRateMismatch", estimateDateRate: ..., deadlineRate: ... };
}
const estimate = await deps.createCommand.execute({ ...input, taxRate: check.rate.value });
return { kind: "created", estimate };
```

- 税率関心は既存の `TaxRateConsistencyCheckDomainService` を再利用（ロジック統一）。app-shared 税率ヘルパとして `checkTaxRateThenSave` と同型（対称性は保たれるべき場所＝app-shared に置く）。
- フィクスチャ／seed はコマンドを直接叩くので一切壊れない。
- フォームに税率入力欄が無く、アクションは税率を受け取らない（導出に一本化）。

## 決定

**見積作成の税率導出＋§8.7 整合チェックは選択肢 B で行う。** `CreateEstimateCommand` は純粋な組立器として据え置き、app-shared `checkTaxRateThenCreate` が §8.7 チェック→解決税率での委譲を担い `{ created | taxRateMismatch }` を返す。Server Action はこのラッパを使い、`taxRateMismatch` をフォームエラー化する（§8.7「保存時＝その場で修正」）。

## 根拠

- **統一すべきはロジックであってコマンドの戻り値型ではない**: 税率導出・整合判定は既存の `TaxRateConsistencyCheckDomainService` を再利用する（同じ `findEffectiveAt` を編集画面と共有）。フィクスチャを壊してまでコマンド戻り値まで C2/C3/C4 に揃える実益は薄い。
- **作成は更新に無い「導出」を持つ**: 作成系の税率関心は「導出＋チェック」で更新系（チェックのみ）と本質的に非対称。専用の app-shared オーケストレーションを置くのは正当な非対称であり、`checkTaxRateThenSave` ↔ `checkTaxRateThenCreate` の対比として app-shared 層では対称性が保たれる。
- **`CreateEstimateCommand` の再利用性を守る**: 多数のフィクスチャが依存する「純粋な組立器」という性質を維持でき、テスト前提づくりが軽いまま。
- **不採用理由（A）**: 完全対称と引き換えにフィクスチャ一斉破壊を招き、コマンドから純粋性を奪う。得られる対称性は app-shared 層で B でも確保できる。

## 影響

- **C1 だけ税率チェックの所在が異なる非対称が残る**: C2/C3/C4 はコマンドが所有、C1 は app-shared ラッパが所有。本 ADR がその理由（導出の有無・フィクスチャ依存）を記録する。将来 C2/C3/C4 を「導出も行う」方向へ揃える場合は、本判断の再考が要る。
- **`CreateEstimateInput.taxRate` は実経路では常に上書き**: ラッパが導出税率を詰めるため、フォーム経路では `taxRate` 入力は実質使われない（seed/テストは引き続き明示供給）。軽い冗長として許容する。
- **作成配線ファクトリ**: ラッパは `TaxRateConsistencyCheckDomainService`（＋ `TaxRateRepository` 実装）と `CreateEstimateCommand`（セット検証のため `PrismaProductQueryService` 注入・ADR-0052）を解決する Composition Root を新設する。
- **関連**: ADR-0037/0038（Result union の戻り値設計）、ADR-0039（楽観ロック・更新系の `checkTaxRateThenSave` が使う）、ADR-0052（セット構成のライブ検証）、issue #351（C1 UI）、#333（S5・C1 を app/factory/domain まで配線）。
