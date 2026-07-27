# 自動レビュー修正計画 ラウンド 1（PR #653）

`/auto-review-fix 653`（深さ medium / 対象 `develop...HEAD`）のラウンド 1 で judge が採用した指摘への修正方針。

## R1-1 統合レポート artifact に `run_attempt` が付いておらず「Re-run all jobs」で衝突する

| 項目 | 内容 |
|---|---|
| バケツ | ① correctness bug |
| severity（参考） | Medium |
| 対象 | `.github/workflows/playwright.yml:150-155`（`merge-reports` / `Upload merged report`） |

### 問題

shard 側の blob artifact は `blob-report-${{ matrix.shardIndex }}-${{ github.run_attempt }}` と `run_attempt` を含めているのに、`merge-reports` ジョブが上げる統合成果物は `playwright-report` 固定で `run_attempt` を含んでいない。

`actions/upload-artifact` は v4 以降、名前の一意性を **run 単位（attempt 非依存）** で要求し、`overwrite` の既定値は `false`。そのため次の経路で失敗する:

1. shard が 1 つでも失敗する。
2. `merge-reports` は `if: ${{ !cancelled() }}` により実行され、`Upload merged report` で `playwright-report` を**アップロードし終えた後**に `Fail if any shard failed` が意図的に `exit 1` する（upload を先に置く設計は L157-159 のコメントどおり）。
3. この run に対し「Re-run all jobs」を行うと `merge-reports` も再実行され、同一 run にすでに存在する `playwright-report` と名前が衝突して `Upload merged report` がアップロードエラーで落ちる。

「Re-run all jobs」は ADR（`docs/adr/20260727-55f-e2e-ci-parallelization-by-shard.md` L105）が**唯一サポートすると明言している再実行手段**であり、その手段自体が壊れている。

### なぜ計画準拠での却下にならないか

計画ファイル `shard-e2e-workflow-with-report-merge.md` の「artifact 名と再実行」（L57-61）は、選択肢 **A.『`github.run_attempt` を含める』を artifact 一般の方針として採用**すると決めている。しかし Step 2 の作業内容は blob artifact への適用（L117）だけを書き、統合レポート（L119）には書き漏らしている。**意図的な差別化ではなく、決定を実装へ落とす際の適用漏れ**であるため、計画準拠での却下には当たらない。

補強材料として、Playwright 公式の sharding サンプル（`playwright.dev/docs/test-sharding`）は統合後の HTML レポート側にのみ `name: html-report--attempt-${{ github.run_attempt }}` を付けており、本 PR は保護箇所が反転している。

### 修正方針

`Upload merged report` の artifact 名を `playwright-report-${{ github.run_attempt }}` に変更し、blob 側と同じ理由づけがここにも効くことをインラインコメントで残す。

`overwrite: true` を付ける案は採らない。理由: 前 attempt の統合レポートを破棄してしまい、失敗した run の証跡を追えなくなる。計画の決定 A（`run_attempt` を含めて並存させる）と方針が一致するのは改名の側。

### 影響範囲

- `.github/workflows/playwright.yml` のみ。`playwright-report` という artifact 名を参照している他のワークフロー・スクリプトは存在しない（grep 済み）。
- artifact のダウンロード経路も無い（`merge-reports` が消費するのは `blob-report-*` のみ）。
- 再実行時に `playwright-report-1` / `playwright-report-2` が並存する。retention 30 日の範囲で古い attempt の統合レポートも残るが、どの attempt の結果かが名前で判別できるようになる利点の方が大きい。

### 想定テスト

テスト不要（CI 設定ファイル）。検証は次の run で `playwright-report-1` という名前の artifact が生成されることの確認による。「Re-run all jobs」の実地検証は赤い run が必要なため、本 PR では行わない。

---

## 記録に残す判断

計画ファイル本体（Step 2 / Step 4 の実測結果）は完了済みの記録なので書き換えない。計画の決定 A と実装の食い違いは本ファイルに記録して突き合わせ可能にする。
