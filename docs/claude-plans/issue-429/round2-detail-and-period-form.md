# 共通売単価 保守画面 FE変換 — ラウンド2（詳細ページ＋PeriodForm）

> ラウンド1（データ境界＋一覧 UC-1）の続き。`grill-with-docs` ラウンド2セッションで確定した設計合意。用語正準＝`CONTEXT.md`「価格」節、ユースケース＝`docs/claude-plans/issue-429/use-cases.md`、全体設計＝`fe-conversion-plan.md`。本ラウンドは **詳細ページ（UC-2）＋登録/編集/適用終了/削除（UC-3/4/5）＋楽観ロック経路** をモック境界上で実装する。

## 確定した設計判断（ラウンド2グリル）

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| 1 | 不変条件の enforcement 置き場所 | **`mock-store.ts` のミューテータに集約**（モックストア＝ドメイン集約のスタンドイン）。Server Action は parse→ミューテータ→catch→revalidate の薄いガワ | 既存Action本番同形を維持。捨てるロジックを1モジュールに凝集。読み取り側(classify/productStatus)と同方針 |
| 2 | インラインパネルの開閉モード | **クライアント状態（client wrapper の `useState`）**。URLには載せない | パネル開閉は揮発的UI状態。URL searchParam は往復＋履歴汚染。サーバ権威はAction側で担保 |
| 3 | Action/スキーマ粒度 | **操作別に分割**（`addPeriod`/`updateFuturePeriod`/`endDateCurrentPeriod`/`deletePeriod`）。単一 `PeriodForm` がモードで送信先と活性フィールドを切替 | 将来ドメインも操作別コマンド。各入力契約を最小化し、現在有効行の開始日・単価は契約に存在しない＝改竄不能（disabled頼みにしない） |
| 4 | 楽観ロック | **集約ルート version 1個**。全ミューテータが `expectedVersion` をcheck&bump。競合は既存 `ConflictError` 文言をパネル内フォームエラーに表示。自動リカバリなし | types.ts/ADR-0039で既定。削除も version 突合（ProductDeleteForm同形）。形を本番同形に保つのが決定#9の目的 |
| 5 | 削除（UC-5）確認UX | **行内2段階確認**（wrapper のモードに `delete` 追加 → [削除する]/[取消]）。shadcn AlertDialog は使わない | 行内の削除はミスクリックriskが高い。undo無しの物理削除に最小ガード。パネル用 client state を流用し追加依存なし |
| 6 | バリデーション規則と層 | zod層（単項目・client+server）= 開始必須/実在日・終了>開始(厳密)・単価≥0整数。ミューテータ層 = 重複判定（`[start,end)`・end=null→+∞・接触許容・自己除外） | 半開区間ゆえ終了>開始厳密、接触許容で改定フローを通す。単価0許容（ルール3）。集約横断の重複は必ずサーバ最終判定 |
| 7 | 最低1期間前提（ルール5）の削除ガード | **件数ガードは入れない**。削除ガードは時点状態のみ（将来行限定） | 確定方針1（第一段階はハード強制せず可視化＋安全弁に委ねる）。モックは Product 有効/無効を持たず「有効商品か」を判定不能。add→delete で未設定化はUC-5本来用途 |
| 8 | revalidate範囲・遷移 | 成功後 **詳細＋一覧の両パスを `revalidatePath`**、**redirectせず詳細に留まる**、成功時 wrapper がパネルを閉じる。トーストなし | 適用終了/追加/削除は一覧の現在有効単価・ステータスを動かす（失効中バッジ）。インライン編集はその場完結が自然 |
| 9 | テスト方針 | **不変条件の純粋ロジックのみ Vitest**（重複・状態別権限・日付関係）。Action/store結合テストは書かない | 重複・状態別権限は核心仕様＝テストが仕様を文書化し #466 ドメインへケース移植可能。framework糊は手動＋プローブ（ラウンド1踏襲） |

## ファイル構成（`src/app/(features)/common-selling-prices/` 配下）

- `_data/period-rules.ts`（新規）— 純粋述語: `overlaps` / 状態別権限（`canEdit`/`canDelete`/許容フィールド）/ 日付関係。**決定9のテスト対象**。
- `_data/mock-store.ts`（追記）— ミューテータ `addPeriod` / `updateFuturePeriod` / `endDateCurrentPeriod` / `deletePeriod`。`period-rules` を呼び store 副作用＋version check/bump。違反時は**既存 `ConflictError` / `BusinessRuleViolationError`（`_shared`）を throw**（モック専用エラー型は作らない＝Action catch を本番同形に）。新規 periodId は**モジュール内 単調カウンタ**（index採番は delete→add で衝突するため不可）。
- `[productCd]/page.tsx`（新規）— 詳細RSC。`verifySession`→`fetchCommonSellingPriceDetail`→client wrapper へ DTO。存在しない productCd は `notFound()`。
- `[productCd]/PeriodDetailPanel.tsx`（新規）— client wrapper。モード状態（`new` / `edit` / `endDate` / `delete`）＋期間テーブル＋状態バッジ（現在有効/失効/将来）。
- `[productCd]/PeriodForm.tsx`（新規）— 単一フォーム（`useServerForm`/conform）。モードで送信先Action・活性フィールドを切替。適用終了モードは開始日・単価を読み取り専用表示、入力は終了日のみ。
- `[productCd]/actions.ts`（新規）— 操作別 Server Action（parseWithZod→ミューテータ→既存 `handleCommandError` catch→2パス revalidate）。
- `[productCd]/schema.ts`（新規）— 操作別 zod スキーマ。

## コミット分割（表示先行 → 変更）

1. `feat:` 純粋規則 `period-rules.ts` ＋ Vitest テスト（決定9）
2. `feat:` UC-2 詳細ページ表示（RSC＋期間テーブル＋状態バッジ、**読み取りのみ**）
3. `feat:` mock-store ミューテータ（規則呼び出し＋version＋既存エラー throw）
4. `feat:` 操作別 Server Action ＋ zod スキーマ
5. `feat:` PeriodForm ＋ wrapper で UC-3/4/5 を配線（モード切替・インライン削除確認・楽観ロック経路）

各コミットで `pnpm lint` / `pnpm test` 通過を確認。設計判断はコミットボディに記載（CLAUDE.md）。

## 検証

- `pnpm test`（決定9の純粋ロジック単体）
- 手動 `pnpm dev`: 詳細ページ表示（UC-2）→ 将来行の全項目編集 → 現在有効行の適用終了（終了日のみ）→ 失効行が編集/削除不可 → 将来行の追加（重複拒否・接触許容）→ 将来行の削除（2段階確認）→ 一覧へ戻り現在有効単価/失効中バッジが即反映。
- DDD制約: 本ラウンドもFE層のみ。Domain層には触れない（モックは `_data/` 内に閉じる）。

## スコープ外（次ラウンド以降）

改訂ウィザード（合成糖衣）、timeline 表示、跨集約のハード強制（最低1期間）、#466 接続（モック→Factory/QueryService/Command 差し替え）。
