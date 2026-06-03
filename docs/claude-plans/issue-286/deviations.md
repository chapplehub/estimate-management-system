# Issue #286 実装逸脱記録

計画（`value-object-extraction.md`）と実際の実装が異なった点を記録する。

## §1 エンティティ層のバリデーションテストを「更新」ではなく「削除」した

- **元の計画**: Step 2 / Step 3 で「テストフィクスチャ・テストの呼び出し側を VO 生成に更新」。
- **実際の実装**: `EstimateItem.test.ts` の "create() - バリデーション" describe ブロック（商品名空/超過・単位空/超過・メモ超過の 5 ケース）と "商品名 100 文字を受け入れる" ケース、`EstimateVariation.test.ts` の "メモが 2001 文字超ならエラー" ケースを**削除**し、代わりに参照コメントを残した。
- **逸脱の理由**: 長さ・必須バリデーションの責務が `assert*` から VO（`ItemName` / `Unit` / `Memo`）のコンストラクタへ完全に移譲されたため、エンティティ層で同じ境界値を再テストすると VO 単体テスト（Step 1 で追加）と重複する。エンティティはもはや検証ロジックを持たないので、テスト対象が存在しない。境界値網羅は各 VO の `__tests__/{Name}.test.ts` に一元化した。

## §2 plansDirectory の設定更新を実施できなかった

- **元の計画 / フック指示**: Plan Mode 終了時のフックが `.claude/settings.local.json` の `plansDirectory` を `docs/claude-plans/issue-286` に更新するよう示していた。
- **実際の実装**: 計画ファイルは `docs/claude-plans/issue-286/value-object-extraction.md` に正しく配置したが、`settings.local.json` の `plansDirectory` 更新は権限分類器（self-modification）により拒否され未実施。
- **逸脱の理由**: `.claude/settings.local.json` の編集はユーザーの明示要求が無い自己改変としてブロックされた。計画ファイルの配置自体は完了しており実害は無いため、設定値は据え置いた（必要ならユーザーが手動更新可能）。

---

# 後続: Memo null 排除リファクタ（計画: `memo-null-elimination.md`）の逸脱

## §3 論点2（`Memo | null`）を後続決定で上書きした

- **元の計画**: `value-object-extraction.md` 論点2 で `Memo` の null 許容を `Memo | null` とした（既存 `ProductNote | null` 流儀踏襲）。
- **実際の実装**: 非null の `Memo` ＋ `Memo.create` による null 吸収（空値 Null Object, A案）に変更。DB 列も `String @default("") NOT NULL` に移行。
- **逸脱の理由**: `Memo | null` だと `EstimateMapper` に DB の `string | null` とドメインの `Memo | null` を変換する null 分岐が漏れ、`Memo | null` がエンティティ全体に伝播して NULL 排除方針と噛み合わなかった。ユーザー承認のうえ後続リファクタとして上書き。判断詳細は ADR-0034 参照。

## §4 コミット粒度を計画の6ステップから調整した

- **元の計画**: `memo-null-elimination.md` Step A-1〜A-6（A-1 で `Memo` の ctor を即 private 化）。
- **実際の実装**: pre-commit フックが全コミットで `tsc` + 全テストを走らせるため、`new Memo` を使う呼び出し側が残った状態で ctor を private 化すると中間コミットがビルド不可になる。そこで「A-1: `create`/`empty`/`isEmpty` を additive 追加（ctor は public 維持）」→「A-2/A-3/A-5 を1コミットに統合（呼び出し側を全移行し、その中で ctor を private 化）」の順に再構成した。
- **逸脱の理由**: 各コミットを緑（ビルド・テスト通過）に保つ制約と、エンティティ⇔Mapper の相互依存（reconstruct シグネチャ非null化と Mapper の非null 生成は不可分）のため。設計内容は計画どおりで、分割の仕方のみ変更。
