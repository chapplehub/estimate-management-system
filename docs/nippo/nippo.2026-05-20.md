# 日報 2026 年 05 月 20 日

## 📝 作業ログ

### 08:41 - 初回記録

今日のテンプレート作成

---

### 12:04 - dev-worktreeスキル作成

dev-worktreeスキル作成

---

### 13:44 - Issue #272 完了

https://github.com/chapplehub/estimate-management-system/issues/272 完了

---

### 18:06 - Issue #274 完了

https://github.com/chapplehub/estimate-management-system/issues/274 完了

---

## 🎯 今日の目標

- [x] 見積ドメインの Prisma スキーマ整備（コア系・受注系）
- [x] dev-worktree スキルの整備

## 📊 進捗状況

### 完了

- **dev-worktree スキル作成**: 旧 bashrc `wta` 関数の後継。ブランチ名正規化→EnterWorktree→依存インストール→Prisma 生成を同一セッションで実施
- **Issue #272 完了**: 見積コア Prisma スキーマ追加（見積本体＋サブタイプ＋バリエーション＋明細＋税率マスタの7モデル）。PR #273
- **Issue #274 完了**: 受注(Order)系・バリエーション系譜(複製/改訂)の Prisma スキーマ追加（5モデル）。PR #276
  - `Order` / `OrderConfirmation` / `OrderCancellation` / `EstimateVariationCopy` / `EstimateVariationRevision`
  - `EstimateVariation` に逆リレーション追加

### 進行中・未着手

- ドメイン層（エンティティ・値オブジェクト・リポジトリ）の実装はこれから

## 💡 学びと気づき

- **状態をカラムでなくイベントテーブルの行の存在で表現する**: 受注の確定/取消を status カラムではなく `OrderConfirmation`/`OrderCancellation` の行の有無で表現。NULL になり得る状態列を排除できる（NULL 徹底排除方針と整合）。
- **複製と改訂は1表統合せず分離**: `kind` 判別子で1テーブルにまとめず `EstimateVariationCopy`/`EstimateVariationRevision` に分割。分類数で割るのではなく列単位・観点で分解する判断フレームに従った。
- **業務エンティティの参照先は `Employee` に統一**: 設計書の `User` 参照を、部署権限チェック(§9)で `departmentId` が必要なため `Employee` に揃えた（#272 の判断を受注系にも踏襲）。

## 🚀 明日への申し送り

- 見積〜受注のデータモデルが揃ったので、次はドメイン層の実装に着手する
- 二重派生の禁止（同一バリエーションが複製かつ改訂であること）はスキーマでは担保しておらず、ドメイン層で担保する必要がある（ADR-0019 方針）
