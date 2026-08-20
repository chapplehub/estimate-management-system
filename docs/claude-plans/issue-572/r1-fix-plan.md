# Issue #572 auto-review-fix ラウンド1 修正計画

`/code-review medium` → judge 評価の結果、採用①②=0件（収束）。採用③=1件のみを処理する。

## 採用 ③ cleanup（1件）

### R5: page.tsx の検索パラメータ抽出の重複解消
- **バケツ**: ③ cleanup（simplification）
- **severity参考**: trivial
- **file:line**: `src/app/(features)/estimate-applications/page.tsx:82`
- **問題**: `criteria` 構築（35-45行）と `defaultSearchValues` 構築（81-90行）で、
  `getStringParam(params, key)` / `getArrayParam(params, key)` を同一キーに対し二度呼んでいる。
  `appliedFrom`/`appliedTo` のみ `appliedFromRaw`/`appliedToRaw` として一度束ねる良形なのに他フィールドは非対称。
- **修正方針**: 各パラメータの生値を criteria 構築前にローカル const へ一度だけ束ね（`estimateNumberRaw` 等）、
  `criteria` と `defaultSearchValues` の両方でその const を参照する。`appliedFromRaw`/`appliedToRaw` の既存流儀に揃える。
- **採用根拠（③3基準）**:
  1. 挙動不変: 同じ関数を同じ引数で呼んだ結果を const 経由で共有するだけ。出力は完全同一。
  2. 設計判断不要: 生値の const 化と参照差し替えの機械的整理。置き場所・抽象化の迷いなし。
  3. 局所的: `page.tsx` 単一ファイルに閉じる。公開シグネチャ変更なし。
- **影響範囲**: `src/app/(features)/estimate-applications/page.tsx` のみ。
- **想定テスト**: 既存の型チェック（`pnpm lint`）＋既存 E2E が緑のまま（挙動不変の担保）。純粋整形のためユニット追加なし。

## 却下・残課題 ④（5件・修正しない）
- R1 formatYen 再実装 → ③基準未達（金額整形2系統併存で置き場所非一意）＋計画準拠(deviations#2)
- R2 SUBMISSION_TYPE_LABELS 重複 → 計画準拠(deviations#2)＋③基準未達
- R3 ModalSearchForm silent null → 誤検知（実バグ未発火）＋設計判断要
- R4 SearchForm useState 再同期なし → スコープ外（既存挙動・本PR回帰でない）＋設計判断要
- R6 formatDateTime 二拠点化 → 計画準拠(deviations#2)＋表示フォーマッタ共有ホーム未確立で設計判断要
