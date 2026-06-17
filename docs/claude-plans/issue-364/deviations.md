# Issue #364 実装計画からの逸脱記録

## 1. コンポーネント単体テストを追加した（計画では「存在しない・追加しない」想定だった）

- **元の計画**: 保存した計画書では「`VariationPanel` / `VariationCreateForm` のコンポーネント単体テストは存在しない。安全網は TypeScript の網羅性検査 ＋ E2E（create/edit）の二段」とし、新規コンポーネントテストは追加しない前提だった。
- **実際の実装**: `/tdd` 着手時にテスト基盤を再確認したところ、RTL（`@testing-library/react` / `user-event` / `jsdom`）が整備済みで、`SigninForm.test.tsx` / `EmployeeCreateForm.test.tsx` 等の `.test.tsx` 先例がプロジェクト規約として存在することが判明。`VariationPanel.test.tsx` を新規作成し、提出区分の振る舞い（新規＝選択／複製＝引き継ぎ固定／FormData 送信値）を固定する characterization テスト3本を追加した。
- **逸脱の理由**: 「コンポーネントテストは存在しない」という計画前提が誤りで、基盤・規約ともに揃っていた。リファクタ（とくに submissionType の uncontrolled 化）の退行を型と E2E だけでなくコンポーネントテストでも捕捉できるため、安全網を厚くする方が妥当と判断。ユーザーと `/tdd` のプランニング段階で合意のうえ追加した。

## 2. テスト対象を `VariationCreateForm` 直接ではなく `VariationPanel` 経由にした

- **元の計画**: 計画書ではテスト対象コンポーネントを明示していなかった（テスト追加自体を想定していなかったため）。
- **実際の実装**: 提出区分の挙動を `VariationPanel`（props 不変の安定インターフェース）越しに検証した。
- **逸脱の理由**: 本リファクタで `VariationCreateForm` の props 形状自体（`initialValues?` → `{ kind }` union）が変わるため、フォームを直接 render するテストはリファクタで書き換えが必要になり「テストは内部リファクタを生き延びる」原則に反する。props が変わらない `VariationPanel` 経由にすることで、フォームの props 変更を *内部リファクタ* として扱え、テストを緑のまま維持できた。

## 3. submissionType 既定値の与え方を `useServerForm` の defaultValue に一本化

- **元の計画**: 「複製＝hidden 固定値／新規＝`defaultValue` 付き uncontrolled select」。新規 select に明示的な `defaultValue="CUSTOMER"` を付ける想定だった。
- **実際の実装**: 既定値は `useServerForm` の `defaultValue.submissionType`（複製＝複製元値／新規＝`"CUSTOMER"`）を単一の源泉とし、select 側は `getSelectProps(field)` がその初期値を反映する形にした（select に明示的 `defaultValue` 属性は付けない）。
- **逸脱の理由**: 既定値の源泉を1箇所に集約した方が、select（新規）と hidden（複製）の双方の初期値が同じ場所から決まり読みやすい。挙動は計画と等価（E2E・コンポーネントテストで確認済み）。
