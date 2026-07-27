# 自動レビュー修正計画 ラウンド 2（PR #653）

`/auto-review-fix 653`（深さ medium / 対象 `develop...HEAD`）のラウンド 2 で judge が採用した指摘への修正方針。

## R2-1 失敗集約ステップが merge のクラッシュでスキップされる

| 項目 | 内容 |
|---|---|
| バケツ | ① correctness bug |
| severity（参考） | Medium |
| 対象 | `.github/workflows/playwright.yml:166-170`（`merge-reports` / `Fail if any shard failed`） |

### 問題

GitHub Actions のステップは、`if:` に `always()` / `failure()` / `cancelled()` のいずれも含めない場合、**書いた条件に暗黙の `success()` が AND される**。

`Fail if any shard failed` の条件は `if: ${{ needs.test.result != 'success' }}` でこれらを含まないため、実際の意味は「**直前のステップが成功しており、かつ** test ジョブが success でない」になる。つまり直前の `Merge into single HTML report` が失敗した瞬間、失敗を報告するためのステップ自身がスキップされる。

これが現実に起きる経路:

1. 全 shard がテスト実行**前**の共通ステップ（migration / seed / ブラウザインストール）で失敗する。DB マイグレーションの破損や Postgres サービスコンテナの起動不良で起こりうる、レアではないケース。
2. どの shard も `blob-report/` を生成しない。`Upload blob report` は対象 0 件のため `if-no-files-found` の既定 `warn` で「警告のみ・成功扱い」となり、artifact 自体が作られない。
3. `merge-reports` は `if: ${{ !cancelled() }}` で起動し、`Download blob reports` も 0 件マッチで正常終了する。
4. `Merge into single HTML report` が空ディレクトリを渡され、`Error: No report files found` / exit 1 で落ちる（`playwright@1.58.0` の `lib/reporters/merge.js:55` `createMergedReport`。空ディレクトリでの実測により確認済み）。
5. 暗黙の `success()` により `Fail if any shard failed` がスキップされ、設計された `::error::E2E shard job result: ...` という原因メッセージが一度も出力されない。

CI 自体は赤くなるため誤 green にはならない。しかし残るのは一見無関係な Playwright 内部エラーだけで、原因調査を誤誘導する。この PR の主目的の一つが「shard 失敗の集約伝播」（計画 L54-55 / ADR L104）である以上、その集約ステップが黙る経路は放置できない。

### 修正方針

`Fail if any shard failed` の条件を `if: ${{ !cancelled() && needs.test.result != 'success' }}` に変更する。ステップの位置は現状のまま `Upload merged report` の**後**に据え置く。

**`always()` ではなく `!cancelled()` を採る判断**: judge の提案は `always()` だったが、`always()` は run 全体がキャンセルされた場合にもステップを実行するため、キャンセルされた run で `needs.test.result` が `cancelled` になり `::error::` アノテーションと exit 1 を出してしまう（キャンセルは失敗ではない）。`!cancelled()` なら「run がキャンセルされていない限り、直前ステップの成否によらず実行」となり、意図に正確に一致する。加えて `merge-reports` ジョブ自身の条件（`if: ${{ !cancelled() }}`）と同じ述語になり、ジョブとステップで条件が揃って読みやすい。

**既存の意図を壊さないこと**: 計画 L120 とコメント L157-159 が定める「upload を先に行い、その後に fail させる」設計はステップの並び順が担保しており、今回変えるのは「直前ステップが失敗していても実行されるか」だけ。merge が成功する通常経路の挙動は従来と完全に同一。

### 影響範囲

- `.github/workflows/playwright.yml` の 1 ステップの `if:` のみ。
- 通常経路（全 shard 成功 / 一部 shard 失敗だが blob は存在する）の挙動は不変。
- 変わるのは「blob が 1 つも存在せず merge がクラッシュする」経路のみで、そこで初めて集約メッセージが出るようになる。

### 想定テスト

テスト不要（CI 設定ファイル）。空ディレクトリに対する `playwright merge-reports` が exit 1 になることはローカル実測で確認済み。実地検証には全 shard を infra 段階で失敗させる必要があるため、本 PR では行わない。
