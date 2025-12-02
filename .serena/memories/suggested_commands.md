# 開発コマンド一覧

## 開発サーバー
```bash
npm run dev              # 開発サーバー起動 (http://localhost:3000)
```

## ビルド・本番
```bash
npm run build           # 本番用ビルド
npm start              # 本番サーバー起動
```

## テスト
```bash
npm test               # Vitest でテスト実行
npm test -- --watch    # ウォッチモード
npm test -- --coverage # カバレッジ付き
```

## リント
```bash
npm run lint           # ESLint 実行
```

## データベース操作
```bash
npm run db:studio      # Prisma Studio 起動（DB GUI）
npm run db:migrate     # マイグレーション実行
npm run db:push        # スキーマをDBに反映
npm run db:generate    # Prisma Client 生成
npm run db:seed        # シードデータ投入
```

## Git 操作
```bash
git status             # 状態確認
git diff               # 変更差分
git log --oneline      # コミット履歴
git branch             # ブランチ一覧
```

## システムユーティリティ（Linux）
```bash
ls -la                 # ファイル一覧
tree -L 2              # ディレクトリ構造
find . -name "*.ts"    # ファイル検索
grep -r "pattern" .    # パターン検索
```

## データベース接続情報
- **ホスト**: localhost:5432
- **データベース名**: estimate_management_dev
- **接続文字列**: `.env.local` を参照（テンプレート: `.env.example`）
