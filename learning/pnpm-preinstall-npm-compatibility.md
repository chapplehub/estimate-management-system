# pnpm preinstall と npm の互換性問題

作成日: 2026-01-27

## 概要

pnpm 移行後に `preinstall` スクリプトで npm をブロックしようとした際、想定外の動作に遭遇した。pnpm と npm の node_modules 構造の違いが原因。

## 設定内容

```json
{
  "scripts": {
    "preinstall": "npx -y only-allow pnpm"
  }
}
```

## 想定していた動作

```
npm install 実行
    ↓
preinstall 実行
    ↓
only-allow が「npm で実行されている」と検出
    ↓
きれいなエラーメッセージを表示して終了
╔═════════════════════════════════════════════════════════════╗
║   Use "pnpm install" for installation in this project.      ║
╚═════════════════════════════════════════════════════════════╝
```

## 実際に起きた動作

```
npm install 実行
    ↓
npm が既存の node_modules を読み込もうとする
    ↓
pnpm の .pnpm/ 構造を解釈できずクラッシュ
    ↓
TypeError: Cannot read properties of null (reading 'matches')
```

**preinstall は一度も実行されなかった**

## 原因：node_modules 構造の違い

| パッケージマネージャ | node_modules 構造 |
|-------------------|------------------|
| **npm** | フラットな構造（全パッケージが直下に展開） |
| **pnpm** | `.pnpm/` ディレクトリ + シンボリックリンク |

npm は実行時に以下の順序で処理を行う：

1. **既存の node_modules を読み込む** ← pnpm 構造でクラッシュ
2. 依存関係ツリーを計算
3. **preinstall を実行** ← ここに到達しない
4. パッケージをインストール

## ケース別の動作

| 状況 | node_modules | 結果 |
|-----|-------------|------|
| 新規クローン | なし | ✅ preinstall が実行され、きれいなエラー |
| pnpm でインストール済み | .pnpm/ 構造 | ❌ npm がクラッシュ |
| npm でインストール済み | フラット構造 | ✅ preinstall が実行される |

## 結論

- **preinstall の設定は正しい** - 新規クローン時は想定通り動作する
- **pnpm インストール後に npm を試すと**クラッシュするが、これは「npm が使えない」という点では目的達成
- エラーメッセージは不親切だが、実害はない

## 補足：npx -y フラグについて

npm v7 以降、`npx` はパッケージダウンロード時に確認を求めるようになった：

```
Need to install the following packages:
only-allow@1.2.2
Ok to proceed? (y)
```

`-y` フラグを追加することで確認をスキップし、自動的にダウンロード・実行する。

## 参考

- pnpm 公式ドキュメント: https://pnpm.io/ja/only-allow-pnpm
- npm lifecycle scripts: https://docs.npmjs.com/cli/v10/using-npm/scripts
