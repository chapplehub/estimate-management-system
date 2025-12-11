# Serena MCP と Claude Code の連携問題: web_dashboard 設定が stdio 通信を妨害する

## 概要

Serena MCP サーバーを Claude Code で使用する際、`~/.serena/serena_config.yml` の `web_dashboard: true` 設定が原因で、Claude Code がツールを認識できない問題が発生する。

## 症状

- `/mcp` コマンドで `Status: ✔ connected` と表示されるが `Capabilities: none` となる
- Serena のログでは `Starting MCP server with 21 tools` と正常に起動している
- Claude Code 側では Serena のツールが一切使用できない

## 原因

`web_dashboard: true` の設定は、Serena 起動時に HTTP サーバー（ポート 24282）を立ち上げてブラウザを開こうとする。このとき以下のいずれかが発生する可能性がある：

1. **stdout/stderr の競合** - MCP プロトコルは stdio（標準入出力）で通信する。Web ダッシュボードの起動処理が stdout に何らかの出力を行い、MCP プロトコルのハンドシェイクを妨害する
2. **起動タイミングの問題** - ダッシュボード起動とブラウザ起動の処理が、MCP の初期化応答（`initialize` レスポンス）を返す前に割り込む
3. **プロセスのフォーク** - ブラウザを開く処理がサブプロセスを生成し、親プロセスの stdio を乱す

## 解決方法

`~/.serena/serena_config.yml` で以下の設定を `false` に変更する：

```yaml
web_dashboard: false
web_dashboard_open_on_launch: false
```

## 正常動作時の `/mcp` 出力

```
│ Serena MCP Server
│ Status: ✔ connected
│ Capabilities: tools
│ Tools: 21 tools
```

## 関連設定ファイル

### ~/.serena/serena_config.yml

```yaml
web_dashboard: false
web_dashboard_open_on_launch: false
log_level: 10  # debug レベルにするとトラブルシュート時に便利
```

### .mcp.json

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "claude-code",
        "--project",
        "/path/to/project"
      ],
      "env": {}
    }
  }
}
```

### .claude/settings.local.json

```json
{
  "permissions": {
    "allow": ["mcp__serena", "mcp__context7"]
  },
  "enabledMcpjsonServers": ["context7", "serena"]
}
```

## 参考

- Serena GitHub: https://github.com/oraios/serena
- Serena ドキュメント: https://oraios.github.io/serena/
- Claude Code MCP 設定: https://oraios.github.io/serena/02-usage/030_clients.html
- Serena ログ: `~/.serena/logs/YYYY-MM-DD/mcp_*.txt`

## 備考

この問題は Serena のバグとして報告する価値がある。stdio ベースの MCP クライアント（Claude Code）との互換性問題として Issue を作成することを検討。
