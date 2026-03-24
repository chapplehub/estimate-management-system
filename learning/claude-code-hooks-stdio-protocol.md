# Claude Code Hooks の標準入出力プロトコル

作成日: 2026-03-13

## 概要

Claude Code（親プロセス）と Hook スクリプト（子プロセス）間で、標準入出力（stdin/stdout/stderr）と終了コード（exit code）を使ってどのように情報をやり取りするかを学んだ。

## 詳細

### プロセス間の通信チャネル

Hook スクリプトは Claude Code の子プロセスとして実行される。通信には4つの経路がある。

```
              ┌─────────────────┐
  stdin   →  │                 │  → stdout    (echo, cat, printf の出力先)
  (JSON)     │  Hook スクリプト   │  → stderr    (>&2 の出力先)
              │                 │
              └────────┬────────┘
                       │
                 exit code (0, 1, 2)
```

| チャネル | 方向 | 用途 |
|---|---|---|
| **stdin** | Claude Code → Hook | イベント情報を JSON で渡す（tool_name, tool_input 等） |
| **stdout** | Hook → Claude Code | コンテキスト注入（テキスト）や制御指示（JSON） |
| **stderr** | Hook → Claude Code | エラーメッセージ（exit code 2 の時に Claude に伝わる） |
| **exit code** | Hook → Claude Code | 処理結果の判定（0=成功, 1=非致命的エラー, 2=ブロック） |

### Claude Code が出力を処理するタイミング

**Hook プロセスが終了（exit）した後に、一括で処理する。**

`echo` のたびにリアルタイムで反応するのではなく、子プロセスの終了を待ってから stdout 全体を読み取る。

```
時間軸 →

Hook 側:   echo "1" → echo "2" → echo "3" → exit 0
           ↓          ↓          ↓          ↓
stdout:   バッファに蓄積 ──────────────────→ パイプ閉じる
                                             ↓
Claude Code:                           ここで初めて全部読む
                                       stdout = "1\n2\n3\n"
                                       exit code = 0
```

これはOSレベルのプロセス間通信の仕組みで、stdout はパイプ（バッファ）に蓄積され、子プロセス終了時にパイプが閉じられて親が全体を読み取る。

### exit code と stdout/stderr の組み合わせ

| exit code | stdout | stderr | Claude の動作 |
|---|---|---|---|
| `0` | テキスト | — | テキストをコンテキストに追加 |
| `0` | JSON | — | JSON を解析して制御に使う（decision, additionalContext 等） |
| `2` | **無視される** | エラー文 | アクションをブロック + stderr を Claude にエラーとして伝達 |
| `1` | **無視される** | エラー文 | 続行（stderr は verbose モードのみ） |

### stdout の2つの形式

#### A. プレーンテキスト

```bash
echo "このプロジェクトでは main への直接 push は禁止です"
exit 0
```

SessionStart や UserPromptSubmit では `<system-reminder>` として会話に注入される。

#### B. 構造化 JSON

```bash
cat << 'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "本番DBへの接続は禁止されています"
  }
}
EOF
exit 0
```

JSON の場合も複数の `echo` で分割出力しても、最終的に stdout 全体が1つの JSON として解析される。

### 実例：explanatory-output-style プラグイン

このプラグインの SessionStart Hook は以下のように動作する：

1. Claude Code が Hook を子プロセスとして起動（stdin に JSON を渡す）
2. Hook は `cat << 'EOF'` で JSON を stdout に出力
3. `exit 0` で終了
4. Claude Code がプロセス終了を検知し、stdout の JSON を読み取る
5. `hookSpecificOutput.additionalContext` の内容を `<system-reminder>` として会話に注入

## 参考

- プラグインの Hook 定義例: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/explanatory-output-style/`
- settings.json の Hook 設定: `~/.claude/settings.json`
