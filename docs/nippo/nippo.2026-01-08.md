# 日報 2026年01月08日

## 📝 作業ログ

### 10:18 - 従業員一覧に検索機能追加

従業員一覧に検索機能追加

### 11:36 - データ形式の整理

このアプリケーション内ではデータ形式は３種類ある。
表示するデータ形式
ドメインデータ形式
Prismaで保存するためのモデル形式

### 11:37 - ValueObject継承の確認

EmployeeNameで長さによるバリデーションチェックがないと思ったけど
継承しているStringValueObjectでやっていた

### 14:33 - issue40対応 検索機能追加

issue40対応 検索機能追加 https://github.com/chapplehub/estimate-management-system/issues/40

### 14:52 - issue40完了・issue41対応中

issue40対応完了したが、検索時に大文字小文字を区別している問題発生issue41として対応中

### 15:13 - issue41対応完了

issue41対応完了 prisma利用時にmode: "insensitive"を設定するだけでよかった。照合順序設定
PostgreSQLはデフォルトで決定論的照合のため、検索対象のフィールドごとにこの設定が必要。

### 16:07 - ひらがな/カタカナ照合調査

ひらがなカタカナを区別せず検索する照合順序の指定もできるのかと思ったがSQLServerにはある(_KS)が、PostgreSQLにはなかった
調査結果として一応issue42に挙げておく。

### 16:44 - 実装した検索機能の理解

実装した検索機能の理解

### 16:58 - useRouterについて理解

userouterについて理解
https://nextjsjp.org/docs/app/api-reference/functions/use-router

### 18:00 - useRouter詳細理解

userouterによってクライアントコンポーネントから指定したパスにナビゲーションできる
ブラウザの履歴スタック(history)に新しいエントリを追加できる

### 18:59 - useCallbackについて理解

useCallbackについて理解　下記の２ケース以外はほとんどuseCallbackを使う必要はない。
- memoでラップされたコンポーネントに渡す関数の場合(jsでは常に新しい関数が作成される)
- ほかのuseEffectやuseCallbackの依存配列に設定される関数

---

## 🎯 今日の目標

- [x] 従業員一覧ページに検索機能を追加する（issue #40）
- [x] 大文字小文字を区別しない検索に対応する（issue #41）
- [x] ひらがな/カタカナ区別なし検索の調査（issue #42）

## 📊 進捗状況

**完了したタスク:**
- issue #40: 従業員一覧ページに検索機能を追加（URLクエリパラメータによる検索状態管理）
- issue #41: Prisma `mode: "insensitive"` による大文字小文字区別なし検索を実装
- issue #42: ひらがな/カタカナ区別なし検索の調査完了（実装見送り、将来の参考資料として記録）

**技術的な学習:**
- Next.js useRouter によるクライアントナビゲーション
- React useCallback の適切な使用ケース
- DDDにおける3層のデータ形式（表示用、ドメイン、Prismaモデル）

## 💡 学びと気づき

### Prisma + PostgreSQL での検索
- PostgreSQLはデフォルトで決定論的照合（case-sensitive）
- `mode: "insensitive"` で大文字小文字を区別しない検索が簡単に実装可能
- SQLServerには `_KS` オプションでひらがな/カタカナ区別なし検索があるが、PostgreSQLには同等機能なし

### Value Object パターン
- EmployeeName の長さバリデーションは親クラス StringValueObject で実装されていた
- 継承による共通バリデーションの活用

### React Hooks
- useCallback は以下の2ケース以外ではほとんど不要:
  1. memo でラップされたコンポーネントに渡す関数
  2. 他の useEffect や useCallback の依存配列に設定される関数

### useRouter（Next.js App Router）
- クライアントコンポーネントから指定パスへのナビゲーションが可能
- ブラウザの履歴スタック（history）に新しいエントリを追加できる

## 🚀 明日への申し送り

- ページネーション機能の実装検討（issue #40 関連）
- ひらがな/カタカナ区別なし検索は、データ規模拡大時に WanaKana ライブラリでの実装を検討（issue #42 参照）
