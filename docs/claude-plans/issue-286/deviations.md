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
