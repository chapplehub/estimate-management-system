#!/bin/bash
# PostToolUse hook: git commit 失敗時に警告メッセージを返す
# stdin: Claude Code から渡される JSON（tool_input, tool_result 等）

INPUT=$(cat)

if ! command -v jq &>/dev/null; then
  exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
if [ -z "$CMD" ]; then
  exit 0
fi

# git commit コマンド以外は無視
if ! echo "$CMD" | grep -qE 'git\s+commit'; then
  exit 0
fi

# tool_result を文字列として取得
RESULT=$(echo "$INPUT" | jq -r '
  if .tool_result | type == "string" then .tool_result
  else (.tool_result | tostring)
  end
' 2>/dev/null)

# 非ゼロの Exit code があればコミット失敗
if echo "$RESULT" | grep -qiE 'Exit code [1-9]'; then
  echo "⚠️ COMMIT FAILED: このコミットは作成されていません。修正後は新しい git commit を作成してください。--amend は直前の正常なコミットを破壊するため使用禁止です。"
fi

exit 0
