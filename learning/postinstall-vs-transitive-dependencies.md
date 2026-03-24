# postinstall と transitive dependencies の違い

作成日: 2026-01-27

## 概要

npm/pnpm における `postinstall` スクリプトと `transitive dependencies`（推移的依存関係）は、名前が似ているようで全く異なる概念。pnpm 移行時の警告をきっかけに整理した。

## 詳細

### postinstall（ライフサイクルスクリプト）

**定義**: パッケージがインストールされた直後に自動実行されるスクリプト

```json
// パッケージのpackage.json
{
  "name": "bcrypt",
  "scripts": {
    "postinstall": "node-pre-gyp install --fallback-to-build"
  }
}
```

**主な用途**:
| パッケージ | postinstall で実行される処理 |
|-----------|---------------------------|
| `bcrypt`, `argon2` | C++コードをコンパイルしてネイティブモジュール(.node)を生成 |
| `esbuild` | プラットフォーム用のバイナリをダウンロード |
| `prisma` | Prismaエンジン（Rust製バイナリ）をダウンロード |
| `sharp` | 画像処理用のネイティブバイナリをダウンロード |

**セキュリティリスク**:
postinstall は任意のコードを実行できるため、悪意のあるパッケージが以下のことを行う可能性がある：
- ファイルシステムへのアクセス
- 外部へのデータ送信
- マルウェアのインストール

そのため pnpm はデフォルトでビルドスクリプトをブロックし、`pnpm approve-builds` で明示的な許可を求める。

### transitive dependencies（推移的依存関係）

**定義**: 直接依存しているパッケージが依存している、間接的な依存関係

```
my-project
├── express (直接依存)
│   ├── body-parser (transitive)
│   │   └── raw-body (transitive)
│   └── cookie (transitive)
└── lodash (直接依存)
```

**特徴**:
- `package.json` には記載されない（自動的に解決される）
- `node_modules` にはインストールされる
- lockファイル（`pnpm-lock.yaml`）に記録される

### 比較表

| 観点 | postinstall | transitive dependencies |
|-----|-------------|------------------------|
| **何か** | インストール後に実行されるスクリプト | 間接的な依存パッケージ |
| **タイミング** | インストール直後 | 依存解決時 |
| **目的** | ネイティブモジュールのビルド、バイナリDL | 依存関係の連鎖を解決 |
| **リスク** | 任意コード実行 | バージョン競合、肥大化 |
| **制御方法** | `pnpm approve-builds` | lockファイル、`overrides` |

## 参考

- pnpm公式ドキュメント: https://pnpm.io/cli/approve-builds
- npm scripts lifecycle: https://docs.npmjs.com/cli/v10/using-npm/scripts#life-cycle-scripts
