# issue-626 ラウンド1 修正計画（/auto-review-fix・PR #627）

`/code-review medium`（対象 `develop...HEAD`）の指摘 5 件を judge が評価した結果、**採用①②（correctness bug / 方針・アーキ違反）は 0 件で収束**。採用③（cleanup）3 件のみを本ラウンドで処理する。

前提: `npx tsc --noEmit` は本修正前の時点で exit 0。本 PR は ADR-20260717-w4d 曰く「挙動は完全不変（純型リファクタ）」であり、③ 3 件も同じく挙動不変に留める。

## R1-1: `SetGroupDescriptor<I>` / `VariationDescriptorBase<I>` の型引数を `ItemDescriptorBase` で制約する

| 項目 | 内容 |
|---|---|
| バケツ | ③ cleanup（reuse/altitude 系。型が契約を自己記述する方向） |
| severity（参考） | Low |
| file:line | `src/server/subdomains/estimate/domain/entities/EstimateFactory.ts:99`（`SetGroupDescriptor<I>`）/ 同 :119 相当（`VariationDescriptorBase<I>`） |

### 問題

`SetGroupDescriptor<I>` と `VariationDescriptorBase<I>` の型引数 `I` が無制約。`SetGroupDescriptor` は barrel（`domain/entities/index.ts:38`）からアプリ層へ公開されているため、`SetGroupDescriptor<string>` のような明細記述子でない instantiation が宣言時にはエラーにならない。誤りは遠く離れた `buildVariationChildren(descriptor: VariationDescriptorBase<EstimateItemDescriptor>)` の呼び出し地点で、構造的不一致という読みにくい形で初めて出る。

ADR-20260717-w4d は「核には全経路で意味を持つフィールドだけを置き、型が不変則を語る」方式を採る。その核が `I` に何を要求するのかだけが型に書かれていない状態。

### 修正方針

`SetGroupDescriptor<I extends ItemDescriptorBase>` / `VariationDescriptorBase<I extends ItemDescriptorBase>` へ制約を付ける。JSDoc の「明細型 `I` による径数化」節に、`I` が核を満たすことを型で要求する旨を追記する。

### 影響範囲

instantiation は 6 箇所すべて `ItemDescriptorBase` の部分型（`EstimateItemDescriptor` / `CopiedItemDescriptor` / `RevisedItemDescriptor`）のため、呼び出し側の修正は不要。`EstimateFactory.ts` 1 ファイルに閉じる。

### 想定テスト

型のみの変更で実行時挙動なし。`tsc --noEmit` が緑を保つこと＋既存単体テストが無改修で緑であることで担保する（新規テストは追加しない。ADR-20260717-w4d 決定 3「網羅性 tripwire を置かない」と整合）。

## R1-3: `reviseForCustomer` の `setGroups` map に戻り型注釈を付ける

| 項目 | 内容 |
|---|---|
| バケツ | ③ cleanup（simplification/altitude 系。禁止フィールド検査の有効化） |
| severity（参考） | Medium |
| file:line | `src/server/subdomains/estimate/domain/entities/Estimate.ts:275` |

### 問題

**指摘の当初の理由づけ（「今は freshness で守られており、抽出すると失われる」）は誤り**であることを judge が実測で覆し、こちらでも最小再現で確認した。実際には次のとおり:

- 注釈なし `src.map((g) => ({ ...., forbidden: 1 }))` → **エラーにならない**（`U` がコールバック戻り値から推論され、検査が配列同士の代入性に落ちて freshness が消える）
- 注釈あり `src.map((g): Group<Item> => ({ ...., forbidden: 1 }))` → `TS2353` でエラー

つまり `Estimate.ts` の `setGroups` map は**今すでに群リテラル層で excess property check が効いていない**。隣の `EstimateDuplicationService.ts:166` は同形状の map に `: SetGroupDescriptor<CopiedItemDescriptor>` を明示注釈しており、非対称。

実害は現時点では無い（群レベルに禁止フィールドは存在せず、明細は `toRevisedItem` の戻り型注釈が、`overallDiscount` は `const descriptor: RevisedVariationDescriptor` の直接注釈が捕捉する）。よって①ではなく③。

### 修正方針

`structure.setGroups.map(({ group, components }): SetGroupDescriptor<RevisedItemDescriptor> => ({ ... }))` と戻り型を明示し、`SetGroupDescriptor` を `./EstimateFactory` から `import type` に追加する。**効果は「壊れやすい強制の保全」ではなく、現在効いていない検査を新たに有効化し `EstimateDuplicationService` と対称にすること**。コメントもこの正しい理由で書く（誤った理由づけを埋め込まない）。

### 影響範囲

`Estimate.ts` 1 ファイル 1 箇所＋ `import type` 1 行。現行の群リテラルは全フィールドが `SetGroupDescriptor` 内にあるため、注釈を足しても緑のまま。

### 想定テスト

型のみの変更。`tsc --noEmit` の緑と既存単体テストの無改修緑で担保する。

## R1-5: `toCopiedDescriptor` の JSDoc の `buildSetGroups` 所在誤記を直す

| 項目 | 内容 |
|---|---|
| バケツ | ③ cleanup（ドキュメント正確性） |
| severity（参考） | Low |
| file:line | `src/server/subdomains/estimate/domain/services/EstimateDuplicationService.ts:132` |

### 問題

「id 配線は EstimateFactory.buildSetGroups が行う」と書かれているが、`buildSetGroups` は `estimateChildBuilders.ts:64` にあり `EstimateFactory` には存在しない（#603 で共有ビルダーへ移設済み）。本 PR がこの関数の中身を `Copied*` 記述子へ全面的に書き換えているのに、参照だけ古いまま残っている。読み手が `EstimateFactory` を開いて空振りする。

### 修正方針

参照先を `estimateChildBuilders.buildSetGroups` に訂正する。

### 影響範囲

コメント 1 行。

### 想定テスト

不要（コメントのみ）。

## 修正順とコミット単位

③のみなので①②との衝突は無いが、計画 → 型制約 → 注釈 → コメントの順で細かく割る。

1. `docs:` 本計画ファイル
2. `refactor:` R1-1（型引数の制約）
3. `refactor:` R1-3（map の戻り型注釈）
4. `docs:` R1-5（JSDoc 誤記の訂正）※ ソースコード中のコメントのみのため lint-staged は走るが vitest related はスキップされない点に注意

各コミット後に `pnpm test` / `pnpm lint` で緑を確認し、最後に push する。

## 対応しない指摘（④・報告のみ）

- **R1-2**（型ガードテスト削除により核への `itemDiscount` 移動が検知されない）: ADR-20260717-w4d 決定 3 が「型定義自体の widening 検知は低頻度・レビュー観点でカバー」と明示的に切り捨てる決定をしており、tripwire 不設置も同 ADR の明示決定。**計画準拠のため却下**。ただし「加算が減算より強いのは拡張側への追加に限り、核への追加は両方式とも全経路へ伝播する」という ADR 根拠節への異議は論点として妥当であり、ADR 差替を要する議論として人間の判断に委ねる。
- **R1-4**（群記述子変換が `reviseForCustomer` と二重化）: 意味的に同一のロジックが **2 箇所のみ**で 3 か所以上の基準に未達。共通関数は `mapItem` を引数に取る高階関数となり無状態基準も微妙。何より置き場所が一意に定まらない（片方は集約ルート `entities/`、片方はドメインサービス `services/`）。**③基準未達のため却下**。
