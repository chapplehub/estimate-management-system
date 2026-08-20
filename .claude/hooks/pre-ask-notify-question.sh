#!/bin/bash
# PreToolUse hook (AskUserQuestion): 質問時に ntfy.sh 通知を送信する
# stdin: Claude Code から渡される JSON（session_id 等）

INPUT=$(cat)

SID=$(echo "$INPUT" | jq -r ".session_id" | cut -c1-5)
curl -s -d "Claude Code [${SID}]: Question❓" ntfy.sh/chapple-claude-kmy4b7lnj927 > /dev/null 2>&1 &

exit 0
