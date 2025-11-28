# Claude CLI から MCP サーバーを使う方法

## 概要

Claude CLI（Claude Code）は MCP クライアントを内蔵しており、`.mcp.json` ファイルを作成するだけで MCP サーバーを利用できる。自分で MCP クライアントを実装する必要はない。

## 詳細

### 設定方法

プロジェクトルートに `.mcp.json` を作成：

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

これだけで MCP サーバーが使えるようになる。

### Claude CLI が自動で行うこと

- MCP クライアントの実装（プロトコル通信）
- サーバープロセスの起動・管理
- プロトコルのハンドシェイク
- ツールの自動検出・登録
- LLM へのツール連携

### 通常の MCP 利用との比較

| 項目 | 自分で実装 | Claude CLI |
|------|-----------|------------|
| クライアント実装 | 必要 | 不要 |
| 接続管理 | 必要 | 自動 |
| 設定 | コードで記述 | `.mcp.json` のみ |

### 認証について

- Claude Max/Pro サブスクリプションで OAuth 認証を使用している場合、API キーは不要
- MCP サーバー自体が API キーを必要とする場合は、そのサーバーの設定に従う（Context7 は無料で API キー不要）

### 初回起動時

新しい MCP サーバーを追加した場合、Claude CLI の再起動（新しいセッション開始）が必要。初回起動時に MCP サーバーの承認を求められる。

## 参考

- Claude Code MCP ドキュメント: https://code.claude.com/docs/ja/mcp
- MCP クライアント開発ガイド: https://modelcontextprotocol.io/docs/develop/build-client
- Context7 MCP サーバー: https://github.com/upstash/context7
