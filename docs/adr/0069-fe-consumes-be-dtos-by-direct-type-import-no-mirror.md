# FE は BE の DTO を直 type-import で消費し、ミラー型を作らない（境界の状態語彙は code＋label 単一ソース）

BE/FE 境界の語彙ドリフトを構造的に防ぐため、FE は BE の application 層 DTO を直 type-import で消費し、FE 側にミラー型を持たないことを定める。#473（共通売単価の保守画面をモック境界から実 BE へ接続）で、FE が独自ミラー型（`_data/types.ts`）を先に発明し、後から実 BE と突き合わせて崩れる「語彙ドリフト」が起きた（`productCd` 1個 ↔ BE `productId`＋`productCode` 2個／FE `PeriodState`(current/future/lapsed) ↔ BE status(active/future/expired)）。ミラーは 2 つの型が独立に動けるためドリフトが検知されない。本 ADR は特定機能に閉じない横断規約である。

## 決定

1. **FE は BE の application 層 read DTO を直 type-import する（`import type`）。FE 側にミラー型を作らない。** 型は物理的に 1 つになり、BE が形を変えれば FE が即コンパイルエラーになる＝**コンパイラが契約テストを兼ねる**。サイレントドリフトが構造的に不可能になる。

2. **境界の状態語彙は code＋label を両載せする。** 判別子は安定した機械コード（SCREAMING_SNAKE）とし、日本語表示名は同じ DTO に label として同梱する。**コード集合はドメイン VO を単一ソースとする**（VO の `VALID_VALUES as const` から code 型を export し DTO が使う）。FE は code→日本語の対応表を持たない（正準ラベルは常に BE 供給）。日本語リテラルを判別子に焼き込む label-only 表現は、文言変更が破壊的変更になり BE を表示に密結合するため採らない。

3. **凍結後の契約変更は軽量に扱う。** 契約を変えたくなったら**単一の共有型を編集**し（FE ミラーは決して作らない）、PR 説明に契約変更を明記し、**意味論を変える変更のときだけ**関連 ADR / CONTEXT.md を更新する（任意フィールド追加だけなら不要）。直 type-import によりサイレントドリフトは構造的に不可能なので、手続きは「告知」と「意味変更時の文書化」に留める。

## Considered Options

- **FE ミラー型** — #473 で実証済みの失敗。2 つの型が独立に動きドリフトが検知されない。
- **共有型パッケージ** — 本リポの単一 tsconfig パスエイリアス構成では過剰。直 type-import が最小の単一ソースを与える。
- **状態語彙 code のみ** — FE がラベルを再発明する余地（ドリフト源）を残す。
- **状態語彙 label のみ** — 文言変更が破壊的変更化し BE が表示に密結合する。

## Consequences

- FE の直 type-import は、DTO が推移的に参照するドメイン列挙の型名を FE から構造的に参照させる。`import type` は実行時に消えるため実行時依存は生じず、単一ソース化の利益がこの altitude 上の型漏れを上回る。
- コンパイラが届かない継ぎ目（Server Action の client→command マッピング等）は型では守れないため、各機能側でその配線を契約テストで固定する。
