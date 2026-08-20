# 日報 2026年04月01日

## 📝 作業ログ

### 10:52 - ポートとソケットの学習

ポートとソケットについて学習

### 12:00 - .bashrc改良(wta, settings.local.json)

.bashrc改良(wta test/123で起動できるようにした。settings.local.jsonのコピーするようにした)

### 12:17 - #171 hooks切り出し完了

[#171](https://github.com/chapplehub/estimate-management-system/issues/171) refactor: settings.json のインライン hooks コマンドを .claude/hooks/ シェルスクリプトに切り出す — 完了

### 13:04 - #173 フックバグ修正完了

[#173](https://github.com/chapplehub/estimate-management-system/issues/173) fix: pipe-stage-permissions.sh フックの3つのバグ修正 — 完了

---

## 🎯 今日の目標

- [x] #171 settings.json のインライン hooks を外部スクリプトに切り出す
- [x] #173 pipe-stage-permissions.sh フックのバグ修正（セキュリティ問題含む）
- [x] ポートとソケットの基礎学習
- [x] 開発環境（.bashrc）の改善

## 📊 進捗状況

| 項目 | ステータス | 備考 |
|---|---|---|
| #171 hooks切り出し | ✅ 完了 | 全7フックを `.claude/hooks/` に統一配置、インラインコマンド撤廃 |
| #173 フックバグ修正 | ✅ 完了 | 3件のバグ修正（パス参照エラー、`((i++))` + `set -e` 問題、ワイルドカード問題） |
| .bashrc改良 | ✅ 完了 | `wta` コマンド改善、settings.local.json コピー対応 |
| ポートとソケット学習 | ✅ 完了 | 基礎知識のインプット |

## 💡 学びと気づき

- **`((i++))` と `set -e` の罠**: Bash で `i=0` のとき `((i++))` は後置インクリメントで値が `0`（= exit status 1）になり、`set -e` 下ではサブシェルが即死する。`i=$((i + 1))` が安全な代替手段
- **フックのセキュリティ影響**: ステージ配列が空になると全コマンドが無条件許可される状態だった。セキュリティ系フックは「失敗時にブロック」がデフォルトであるべき
- **settings.json のパス解決**: `$HOME/.claude/settings.json`（グローバル）とプロジェクトローカルの `.claude/settings.json` は別物。フックが参照するパスを間違えると permissions.allow が空になる

## 🚀 明日への申し送り

- [#89](https://github.com/chapplehub/estimate-management-system/issues/89) refactor: 未使用Query クラスの整理（GetAll, Count等）に着手
  - Employee / Customer / DeliveryLocation の未使用 Query を削除（YAGNI原則）
  - `SearchXXXQuery` と `GetXXXByIdQuery` の2パターンに集約する方針
