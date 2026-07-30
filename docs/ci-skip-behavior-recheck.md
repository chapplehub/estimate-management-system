# CI skip 挙動の再検証（使い捨てファイル）

このファイルは changes ゲート（#704）の skip 挙動と run 起票遅延を再計測するための
検証用 PR 専用ファイル。PR はマージせずクローズする。

- 検証日: 2026-07-30
- 検証内容: docs のみの差分で changes ジョブのみが実行され、
  static / test / e2e が skipped になること、および
  「PR 作成 → workflow run 起票」のギャップの再計測
