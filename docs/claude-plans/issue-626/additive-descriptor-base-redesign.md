# Issue #626: 引き継ぎ生成の記述子を「痩せた共有核＋加算拡張」で再設計し、#617 の減算共通化（Required<Omit<>>）を解消する — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

引き継ぎ生成（複製先・改訂先）の記述子型を、減算共通化（`Omit` / `Required<Omit<>>`）から
「痩せた共有核（Base）を additive に拡張する」方式へ組み替える。挙動は完全不変の純型リファクタ。

- 出発点は develop（b41a640b, #616 の `Omit` ベース記述子）。**PR #625 は不採用**（unmerged のままクローズ）。
  #625 のアイデアのうち「明細型 `<I>` による径数化」のみ新設計へ再導入する。
- 「Repriced」語彙は型から完全撤去し、CONTEXT.md の正式語彙「複製先 (Copied)」「改訂先 (Revised)」に型名を一致させる。
- 網羅性 tripwire（`Required`・キー manifest 等）は置かない（#626 本文の明示決定。フィールド追加時の
  引き継ぎ経路反映はレビュー観点でカバー）。
- 完了時に #617 / PR #625 をクローズする（PR 本文に `Closes #617` `Closes #626` を明記し、#625 は手動クローズ）。

### 合意済みの型構成（確定形）

```ts
// ── 明細層 ──
ItemDescriptorBase        = { productId, sortOrder, itemName, quantity, unit, unitPrice,
                              discountRate?, customerMemo?, internalMemo? }   // honest な optional
EstimateItemDescriptor    = Base & { itemDiscount?: Money, revisedDeliveryPrice?: Money | null }
                            // revisedDeliveryPrice は seed が改訂済み見積を直接生成する実需あり。Money | null は現状維持
CopiedItemDescriptor      = Base                                    // 固定値引も改訂明細詳細も名前ごと現れない
RevisedItemDescriptor     = Base & { revisedDeliveryPrice: Money }  // optional Money | null → 必須・非 null に強化（§8.4）

// ── バリエーション層（<I> 径数化）──
SetGroupDescriptor<I>          = { productId, itemName, unit, components: I[], customerMemo?, internalMemo? }
VariationDescriptorBase<I>     = { items: I[], setGroups?: SetGroupDescriptor<I>[], customerMemo?, internalMemo? }
VariationContentDescriptor     = VariationDescriptorBase<EstimateItemDescriptor> & { overallDiscount?: Money }
                                 // 現行の Omit<EstimateVariationDescriptor, ...> が加算で消える
EstimateVariationDescriptor    = VariationContentDescriptor & { variationNumber, submissionType }
CopiedVariationDescriptor      = VariationDescriptorBase<CopiedItemDescriptor>
                                 & { variationNumber, submissionType, sourceVariationId }
RevisedVariationDescriptor     = VariationDescriptorBase<RevisedItemDescriptor> & { variationNumber }
                                 // submissionType は排除（buildRevisedVariation が CUSTOMER を固定しており記述子側は死にフィールド）
EstimateSetGroupDescriptor     = SetGroupDescriptor<EstimateItemDescriptor>    // アプリ層の既存 import を壊さないエイリアス

// ── 見積レベル ──
EstimateFactoryInputBase  = 現行 EstimateFactoryInput の variations 以外の全フィールド
EstimateFactoryInput      = Base & { variations: EstimateVariationDescriptor[] }
EstimateDuplicateInput    = Base & { variations: CopiedVariationDescriptor[] }
// assembleEstimate(input: EstimateFactoryInputBase, variations: EstimateVariation[])
```

構造的代入性により共有ビルダー（`buildVariationChildren` / `buildVariation`）の引数型変更は不要
（`CopiedItemDescriptor` ⊂ `EstimateItemDescriptor`、`RevisedItemDescriptor` の必須 `Money` は
optional `Money | null` に代入可）。

## 設計判断

（/grill-with-docs セッションで確定済み。詳細な理由は各項）

### 出発点と PR #625 の処分
- A. develop 起点で組み替え、#625 は不採用（`<I>` 径数化のアイデアのみ再導入）
- B. #625 をマージ／cherry-pick してから直す
- 採用: A（#617 の前提自体が誤りと #626 が断じており、`Required<Omit<>>` の中間状態を経由する意味がない）

### 核に入れるフィールドの範囲（バリエーション層）
- 核は全経路共通の4フィールド（`items` / `setGroups?` / メモ2種）のみ。
  `variationNumber` / `submissionType` は経路ごとに有無が割れるため核に入れず、各拡張が加算する
  （核に入れると「核なのに一部経路で使えない」という #617 と同種の嘘が再発する）。

### 改訂記述子から submissionType を排除
- 現行は `reviseForCustomer` が `SubmissionType.CUSTOMER` を記述子に書くが `buildRevisedVariation` が
  無視して自前で固定しており、完全に死んでいる。「改訂先は常に得意先宛」の不変則はビルダー1箇所で表現する。

### RevisedItemDescriptor の revisedDeliveryPrice 必須化
- `reviseForCustomer` は全明細に `item.finalAmount` を必ずスナップショットする（§8.4）ため、
  必須・非 null が honest。populate 漏れも本物の不変則としてコンパイルエラーになる。

### 「Repriced」語彙の完全撤去
- 後方互換エイリアスも残さない。「単価再解決経路の共通制約」は核に固定値引が無い構造そのもので表現される。
  概念の記録は ADR-20260714-pv8 と CONTEXT.md（改訂先の定義文）に生きている。

### 型ガードテスト（repricedDescriptor.type.test.ts）の扱い
- retarget せず**ファイルごと削除**。理由:
  - 本物のバグ級（#598: 引き継ぎ経路への固定値引記述）は加算型そのものが構築サイトでコンパイルエラーにする
  - ガードが守る残りは「型定義自体の widening」だけで、それは #626 が明示決定した
    「低頻度・レビュー観点でカバー」の射程内。メタガードを残すのは方針との一貫性を欠く
  - ビルダーガード（`buildVariation` が `revisedFrom` を取らない）も関数シグネチャとして見えており同様

### ドキュメント
- 新 ADR 1本（`docs/adr/20260717-<接尾辞>-....md`、日付＋短ランダム接尾辞規約）:
  (a) 減算共通化 → 加算拡張への機構交換 (b) Copied / Revised 分離と `revisedDeliveryPrice` 必須化
  (c) 網羅性 tripwire を意図的に置かない決定（#617 が混同した「不変則の宣言」と「網羅性の検知」の切り分けを記録）
- ADR-20260716-35a は本文を書き換えず**改訂履歴＋注記を追記**:
  決定1（`Omit` 機構）と型ガード条項は新 ADR に置換、決定2・3（共有ビルダー一本化・buildVariation 分割）は存続
- CONTEXT.md は変更なし（新しいドメイン用語は生まれていない。記述子・核は実装詳細）

### barrel（index.ts）の公開範囲
- 等価交換の最小公開: `RepricedItemDescriptor` / `RepricedSetGroupDescriptor` / `RepricedVariationDescriptor` を外し、
  barrel 経由 consumer（`EstimateDuplicationService`）が使う `CopiedItemDescriptor` / `SetGroupDescriptor` を追加。
  核3型（`ItemDescriptorBase` / `VariationDescriptorBase` / `EstimateFactoryInputBase`）と `Revised*` は
  barrel 非公開（entities 内の相対 import のみ）。

## ステップ

### Step 1: 記述子型の組み替え一式（consumer 追随・型テスト削除込み）
- [ ] **完了**
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts`（核＋加算拡張へ型再定義、`Omit` 一掃）
  - `src/server/subdomains/estimate/domain/entities/estimateChildBuilders.ts`（`buildRevisedVariation` の引数型を `RevisedVariationDescriptor` へ）
  - `src/server/subdomains/estimate/domain/entities/Estimate.ts`（`reviseForCustomer` の記述子構築を `Revised*` 型へ。`submissionType: CUSTOMER` 行を削除）
  - `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts`（`Copied*` / `SetGroupDescriptor<CopiedItemDescriptor>` へ）
  - `src/server/subdomains/estimate/domain/entities/index.ts`（barrel の等価交換）
  - `src/server/subdomains/estimate/domain/entities/__tests__/repricedDescriptor.type.test.ts`（**削除**）
- テスト戦略: テスト不要（挙動完全不変の純型リファクタ。既存単体テストが GREEN のままであることと pre-push の `tsc --noEmit` が担保。新規の実行時挙動なし）
- 作業内容:
  - 合意済みの型構成（概要参照）どおりに `EstimateFactory.ts` の型を再定義する
  - consumer 3ファイル＋barrel を新型名へ追随させる（構造的代入性により共有ビルダーのロジック変更は不要）
  - 型テストファイルを削除する
  - doc コメントの「repriced」「Omit」言及を新方式の説明へ更新する（ADR-pv8 への参照は維持）
- コミットメッセージ: `refactor: 引き継ぎ生成の記述子を痩せた共有核＋加算拡張へ組み替える (#626)`
  - ボディに設計判断（核4フィールドの根拠・submissionType 排除・revisedDeliveryPrice 必須化・型テスト削除の理由）を記載

### Step 2: ADR 起票と ADR-35a への注記追記
- [ ] **完了**
- 対象ファイル:
  - `docs/adr/20260717-<短ランダム接尾辞>-additive-descriptor-base-over-subtractive-commonalization.md`（新規）
  - `docs/adr/20260716-35a-type-enforce-no-fixed-discounts-on-repriced-generation.md`（改訂履歴＋部分置換の注記のみ追記）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容:
  - 新 ADR: 機構交換 (a)(b)(c) を記録（設計判断セクション参照）。ステータス「採用」
  - 35a: 改訂履歴に「決定1と型ガード条項は新 ADR へ置換、決定2・3は存続」を追記
- コミットメッセージ: `docs: 記述子の加算拡張方式と tripwire 不設置の決定を ADR 化 (#626)`

### Step 3: 仕上げ確認と Issue クローズ準備
- [ ] **完了**
- 対象ファイル: なし（確認作業）
- テスト戦略: テスト不要（確認作業。pre-push で全体型チェック＋フルスイートが走る）
- 作業内容:
  - 型の振る舞い（改訂は納品価格必須、複製は固定値引・改訂明細詳細不可、C3/C4 は番号・提出区分が名前ごと無い）が
    型定義だけで表現されていることを最終確認する（#626 タスクのレビュー観点）
  - #603 の個別 `Omit` 対処が「核・拡張のどちらに置くか」で吸収されていることを確認する
  - push（`timeout 600000` 指定）→ PR 作成。PR 本文に `Closes #626` / `Closes #617` を明記し、
    PR #625 のクローズ（unmerged）をユーザーへ依頼する
- コミットメッセージ: なし（Step 3 でコード変更が発生した場合のみ内容に応じて起票）
