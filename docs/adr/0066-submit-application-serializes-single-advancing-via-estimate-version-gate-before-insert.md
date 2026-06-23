# ADR-0066: 見積申請の「1見積1前進」直列化は見積 version 関門を申請挿入の前段に置き、集約またぎトランザクションを張らない

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-23 |
| 最終更新日 | 2026-06-23 |

## コンテキスト

ADR-0058 で「1見積1前進バリエーション」の DB バックストップ（冗長 `estimate_id` ＋部分ユニーク）を手放し、横断不変条件をアプリ層（見積アグリゲートの楽観ロック）に一元化すると決めた。ただし ADR-0058 は「`SubmitApplication`／免除確定は見積アグリゲートを版管理付きで読み書きし version で直列化する（実装はドメイン層 issue）」と方針までを書き、**具体機構は #417 へ先送り**していた。本 ADR はその機構を確定する。

`SubmitApplication`（申請ユースケース）は性質上 **2 つの集約に触れる**:

- `EstimateApplication`（または `EstimateApprovalExemption`）— 新規挿入する対象。本集約は対象見積に触れない（ADR-0053/0054）。
- `Estimate` — `finalTotal`・対象バリエーションの有効性・**前進枠**を持つ集約。

状態を行の存在から導出する設計（ADR-0058）ゆえ DB 側の部分ユニークは張れない。よって「同一見積に前進バリエーションが2つできる」レースを**アプリ層で**締める必要があり、その際 2 集約をどう協調させるか（単一トランザクションで囲うか否か）を決めねばならない。

なお承認チェーン探索は高々 4 段の単一鎖（ADR-0063）に有界で、取得・組立てに性能上の重い処理は無い。

## 検討した選択肢

### A. version 関門を申請挿入の「前段」に置く（分散トランザクション無し）（採用）

`Estimate.version`（ルート楽観ロック・ADR-0039）の条件付き更新を**関門**として申請挿入の前に通し、通過した者だけが挿入へ進む。

```
入力: { variationId, operatorEmployeeId, version }   // version は Preview 時に読んだ Estimate.version
 1. Estimate ロード: 対象 variation が ACTIVE か / 兄弟が前進中(PENDING・APPROVED・免除)でないか  … 逐次正しさ
 2. judge 再評価 → EXEMPT / REQUIRED / BLOCKED（§6.3）
 3. EstimateRepository.update(estimate, expectedVersion = version)   … 関門。version k→k+1
        UPDATE estimates SET version=version+1 WHERE id=? AND version=k   （0行なら ConflictError）
 4. 関門通過後にだけ永続化:
        EXEMPT   → EstimateApprovalExemptionRepository.insert(...)
        REQUIRED → EstimateApplicationRepository.insert(...)   // steps はこの insert 内で原子的
        BLOCKED  → 例外（ADR-0038）
```

- **2 つの関心を分離**: ①逐次正しさ（昨日すでに別バリエーションが前進 → 兄弟チェックで弾く）と、②同時実行の直列化（同じ瞬間に 2 バリエーションを申請 → version 関門で片方だけ通す）。version 関門は同時実行しか防げず、コミット済みの兄弟は兄弟チェックでしか弾けないため**両方必要**。
- **version トークンは 1 個で 2 役**: Preview 時に読んだ `Estimate.version` を `expectedVersion` に使うことで、Preview→Submit 間の金額・組織変化（TOCTOU・§6.3）と同時直列化を**同一トークンで**締める。
- **部分失敗は無害**: 「bump 成功・insert 失敗」が起きても残るのは version が 1 進んだだけの空振り（どのバリエーションも前進していない・再 Preview で回復）。順序が「bump→insert」なので逆（insert だけ成功）は起き得ない。
- **エラー 3 分岐**: bump 失敗 = `ConflictError`（整形済み文言）／bump 成功・insert 失敗 = 新設 `EstimateApplicationPersistError`（「申請に失敗しました。もう一度申請してください。」）／両成功 = 正常 union（`ApplicationSubmitted | ApprovalExempted`）。リカバリは「申請ボタン再押下 → 再 Preview（新 version 取得）→ Submit」に自然に乗る（§6 のフローが毎回 Preview を挟むため）。

### B. 2 集約を単一トランザクションで原子化（不採用）

`TransactionRunner` 等の集約またぎトランザクション抽象を新設し、`Estimate` の version bump と申請挿入を 1 つの DB トランザクションで囲う。

## 決定

**選択肢 A を採用する。** `Estimate.version` の条件付き更新を申請挿入の前段の関門とし、兄弟チェック（逐次）と関門（同時）の二段で「1見積1前進」を担保する。2 集約をまたぐ単一トランザクションは張らない。

## 根拠

- **防ぎたい致命的失敗が無い**。A の唯一の隙「bump 成功・insert 失敗」は、前進バリエーションを生まない無害な version 空振りに留まり、再 Preview で回復する。B が消すのはこの無害ケースだけ。
- **B はコスト倒れ**。本コードベース初の複数集約トランザクション機構＋抽象を #417 で背負うことになるが、承認探索は 4 段有界（ADR-0063）で B の原子性が守る性能・整合の利得が薄い。「最適化（ここでは強整合機構の導入）は必要が立証されてから」。
- **既存の作法と一致**。version トークンを表示時に読み、変更コマンドで持ち回って競合検知する流儀（ADR-0039、`AddVariationInput.version` 等）にそのまま乗る。失敗は例外・複数の正常結末は union（ADR-0037/0038）にも沿う。

## 影響

- `SubmitApplication`／免除確定コマンドは、対象見積を**版管理付きで読み書き**する（意味的変更を伴わない version の touch を含む）。`EstimateApplication` 集約自体は引き続き対象見積に触れない（ADR-0053/0054）— 協調はアプリ層が担う。
- **兄弟チェックと version 関門は両方必須**。どちらか一方では「1見積1前進」を守れない（前者は同時、後者は逐次を取りこぼす）。
- ケース 2 用に `EstimateApplicationPersistError`（アプリ層例外）を新設し、Server Action 側は `error-handler.ts` の推奨ラップパターンで専用文言へ写像する。
- **制約**: bump 後の insert 失敗時、`Estimate.version` が空進みし、同見積への並行操作（別バリエーション編集等）に一過性の `ConflictError` を誘発しうる。楽観ロックの通常挙動（再読込→再試行）で吸収する想定で、追加の補償処理は持たない。
- 申請プレビュー（`PreviewApplication`）は副作用が無いため関門を持たず、judge・組立て・チェーン構築の純粋部分を Submit と共有する（#417）。

## 残存リスク（#440 で追跡）

採用後の #417 実装レビューで、上記「根拠」が唯一の隙とした「bump 成功・insert 失敗」**以外に、もう 1 つの並行性の窓**が判明した。`update()`（version bump）と申請 insert は別トランザクションのため、**bump コミット〜insert コミットの間に窓がある**:

1. T1 が バリエーション A を申請。`update(version=k)` 成功 → `k+1` を**コミット**（A の application 行はまだ未挿入）。
2. その瞬間、T2 が同見積のバリエーション B を Preview し新版 `k+1` を読む。
3. T2 が B を申請。`assertNoAdvancingVariation` は未挿入の A を観測できず通過 → `update(version=k+1)` 成功 → `k+2`、B を insert。
4. A・B が両方 PENDING で前進し、「1見積1前進」が破れる。

version 関門は「同一版を同時に叩く者」しか直列化せず、bump コミット後に新版を Preview した後続は正当に関門を通る。兄弟チェックは非トランザクションのため、この窓を塞げない。`@@unique([variationId, attempt])` は同一バリエーションの重複は弾くが、**別バリエーション**の二重前進は弾けない。

塞ぐには「兄弟チェック＋bump＋insert を単一トランザクション化（選択肢 B 再検討）」「兄弟チェックを条件付き UPDATE と同一 tx へ移す」「DB バックストップ再導入（ADR-0058 の再検討）」のいずれかが要り、ADR-0058/0066 の決定に関わる設計判断を伴う。本 ADR は採用を維持しつつ、この残存窓を既知の制約として記録し、対応は **#440** で追跡する。

## 関連

- ADR-0058（状態を行の存在で導出・DB バックストップ廃止・本 ADR の親）
- ADR-0039（アグリゲートルート version による横断楽観ロック）
- ADR-0037/0038（複数の正常結末は union・失敗は例外）
- ADR-0053/0054（申請・免除テーブルは対象見積に触れない）
- ADR-0055/0062/0063（ゴール判定・段階解決・4 段 fail-fast）
- `docs/business/estimate/システム設計書(申請).md` §6（申請フロー: プレビュー → 確認モーダル → 実行）
- CONTEXT.md「前進バリエーション」
