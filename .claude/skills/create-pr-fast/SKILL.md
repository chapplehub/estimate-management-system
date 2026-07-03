---
name: create-pr-fast
description: GitHub PRを高速に作成する（create-pr の軽量版）。Use when PRを素早く作成したいとき、/create-pr が遅いと感じたとき。plan/逸脱は実ファイルをそのまま埋め込み、モデルはSummaryのみ生成する。
user-invocable: true
context: fork
---

# プロンプト内容

あなたは GitHub PR 作成の専門家です。
#$ARGUMENTS について PR を**最小手数**で作成してください。

このスキルは `create-pr` の高速版です。速度のため次の方針を厳守すること:

- **plan・逸脱記録はモデルで再出力しない**。実ファイルを `cat` で `--body-file` に流し込む
- **モデルが生成するのは Summary（1〜3行）のみ**
- 設計判断の ADR 起票チェックは**行わない**
- `commit-types.md` は**読まない**（接頭辞は恒等写像で解決する）
- Test Plan セクションは**出力しない**

## ステップ 1: コンテキストを1回のコマンドで収集

以下を **1回の bash 呼び出し**でまとめて取得する（ターン数を減らすため個別実行しない）。

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oE 'issue-[0-9]+' | grep -oE '[0-9]+')
# $ARGUMENTS に #123 / 123 が含まれる場合はそちらを優先して ISSUE に採用する
echo "=== branch ==="; echo "$BRANCH"
echo "=== issue ==="; echo "$ISSUE"
echo "=== issue detail ==="; gh issue view "$ISSUE" 2>/dev/null | head -40
echo "=== commits ==="; git log --oneline develop..HEAD
echo "=== changed files ==="; git diff develop..HEAD --stat
echo "=== plan files ==="; ls -1 docs/claude-plans/issue-$ISSUE/*.md 2>/dev/null
```

- issue 番号が `$ARGUMENTS`・ブランチ名のどちらからも取れない場合はエラー終了し理由を返す
- 出力から issue タイトル・コミット履歴を把握し、後続で使う

## ステップ 2: タイトル決定（読み取り不要）

優先順位:

1. `$ARGUMENTS` に明示タイトルがあればそれを使用
2. ブランチ接頭辞をそのまま接頭辞に使う（`feat/`→`feat:`, `fix/`→`fix:`, `docs/`→`docs:` … すべて恒等写像）＋ issue タイトル

例: ブランチ `feat/issue-87` + issue「振り返りレポート付きPR作成スキル」→ `feat: 振り返りレポート付きPR作成スキル`

## ステップ 3: body 構築 → push → PR 作成（1回のコマンド）

Summary だけをモデルが書き、plan/逸脱は `cat` で埋め込む。
`<<'SUMMARY_EOF'` は**クォート付きヒアドキュメント**なので `` ` `` や `$` を含んでも安全（区切り行 `SUMMARY_EOF` 自体だけは Summary 本文に書かないこと）。

以下のテンプレートの `{...}` を埋めて **1回の bash 呼び出し**で実行する:

```bash
set -e
ISSUE={issue_number}
BRANCH=$(git branch --show-current)
PLAN_DIR="docs/claude-plans/issue-$ISSUE"
BODY=$(mktemp)

# --- Summary（モデルが1〜3行で記述） ---
cat > "$BODY" <<'SUMMARY_EOF'
## Summary

{コミット履歴とissue内容から1〜3行の概要}

Closes #{issue_number}
SUMMARY_EOF

# --- 実装計画（deviations.md 以外の .md をそのまま埋め込む） ---
PLANS=$(ls -1 "$PLAN_DIR"/*.md 2>/dev/null | grep -v '/deviations\.md$' || true)
if [ -n "$PLANS" ]; then
  {
    printf '\n## 実装計画\n\n<details>\n<summary>plan mode で作成した実装計画（クリックで展開）</summary>\n\n'
    for f in $PLANS; do
      printf '### %s\n\n' "$(basename "$f")"
      cat "$f"
      printf '\n'
    done
    printf '</details>\n'
  } >> "$BODY"
fi

# --- 計画からの逸脱（deviations.md をそのまま埋め込む） ---
if [ -f "$PLAN_DIR/deviations.md" ]; then
  { printf '\n## 計画からの逸脱\n\n'; cat "$PLAN_DIR/deviations.md"; printf '\n'; } >> "$BODY"
elif [ -n "$PLANS" ]; then
  printf '\n## 計画からの逸脱\n\n計画通りに実装が完了しました。特筆すべき逸脱はありません。\n' >> "$BODY"
fi

# --- footer ---
printf '\n---\n\nGenerated with [Claude Code](https://claude.ai/code)\n' >> "$BODY"

# --- push & PR 作成 ---
git push -u origin "$BRANCH"
gh pr create --base develop --title "{title}" --body-file "$BODY"
```

- base は必ず `develop`（CLAUDE.md 規約）
- `$ARGUMENTS` に `--draft` があれば `gh pr create` に `--draft` を付与する
- plan も deviations も無い場合は「実装計画」「計画からの逸脱」セクションは出力されない（それでよい）

## ステップ 4: 結果を返す

- 作成した PR の番号と URL を簡潔に返す
