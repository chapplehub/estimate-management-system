# Issue #436 実装の計画からの逸脱

## 逸脱1: import 追従対象が src 外（prisma）にも存在した

- **元の計画**: 計画書 Step 2 では Money の被参照を「33 件」とし、列挙・置換対象を
  `src` 配下の grep 結果に基づいて定義していた。
- **実際の実装**: `src` 限定の grep では `prisma/seed-estimates.ts:32`
  （`@subdomains/estimate/domain/values/Money` を import）を取りこぼしていた。tsc の
  `Cannot find module` エラーで発覚し、当該1件も `@server/shared/domain/values/Money`
  へ追従させた（実質34件）。
- **逸脱の理由**: 初回の依存調査を `src` ディレクトリに限定していたため。seed スクリプトは
  `prisma/` 配下にあり Money を直接利用する正当な参照だった。tsc 全体型チェックを最終ゲートに
  置いていたため検出でき、被害は無し。次回以降、VO 移設の参照調査は `src` に加え `prisma/`
  も対象に含める。
