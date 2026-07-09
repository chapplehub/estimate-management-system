# Issue #584 実装の逸脱記録

## 逸脱1: `.env.unit.example` を Claude が作成（計画ではユーザ作成）

- **元の計画（Step 4 改訂版）**: `.env*` は Claude が閲覧・編集できない前提で、`.env.unit.example` と `.env.unit` は Claude が中身を提示し**ユーザが作成**する分担とした。
- **実際の実装**: `.env*` への **Write は可能**だった（ブロックされるのは `.env` の**読み取り**＝Read/`cat`/`sed` 経由の参照のみ）。このため:
  - `.env.unit.example`（プレースホルダ `postgres:postgres`・秘匿情報なし）は Claude が作成しコミットした。
  - `.env.unit` も Claude が一旦作成できたが、実接続情報は `.env` にあり読み取れないため、実認証情報での生成はユーザが `sed 's/estimate_management_dev/estimate_management_unit/g' .env > .env.unit` を実行して行った。
- **逸脱の理由**: 事前の想定（`.env*` 全般が編集不可）が実際は「読み取りのみ不可・書き込み可」だったため。書けるファイル（example）は Claude が巻き取り、読み取れない実 `.env` に依存する部分（`.env.unit` の実認証情報）のみユーザ作業として残した。

## 逸脱2: Step 4 のコミット分割

- **元の計画**: Step 4 を単一コミット `feat: 単体テスト用DBのセットアップスクリプトとenv雛形を追加する` とする想定だった。
- **実際の実装**: env 雛形が独立生成物になったため2コミットに分割した。
  - `feat: 単体テスト用DBのセットアップスクリプトを追加する`（`scripts/unit-setup.ts` + `.gitignore`）
  - `chore: 単体テスト用env雛形（.env.unit.example）を追加する`（`.env.unit.example`）
- **逸脱の理由**: セットアップスクリプト（コード）と env 雛形（設定テンプレート）は関心が異なり、コミット種別も feat / chore に分かれるため。
