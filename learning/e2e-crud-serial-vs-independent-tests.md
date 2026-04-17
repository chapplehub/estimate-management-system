# E2EテストのCRUD serial方式 vs 教科書的独立性

作成日: 2026-04-17
関連: ADR-0012, ADR-0020

## 概要

E2Eテスト業界の「ベストプラクティス」（各テスト独立）と実運用の間には大きなギャップがある。本プロジェクトで採用している「CRUD serial」（create→update→deleteを同一データで直列実行）は、教科書的原則に反するように見えるが、技術制約下では実は合理的な判断であることを整理する。

本ノートは issue #250 の E2E テスト設計スキル策定の議論中に得られた知見のメモ。ADR-0020 および `/create-e2e-test` スキルの前提理解として残す。

## 📚 一般的なE2Eテストの原則

教科書的には**「各テストは独立であるべき」**が強い原則とされている：

- **FIRST原則**: Fast / Independent / Repeatable / Self-validating / Timely
- **Playwright公式ドキュメント**: "Tests should be isolated and able to run in any order"
- **テストピラミッド**（Mike Cohn）: E2Eは少数にし、各々が独立した価値を持つべき

**理由**：
1. 失敗の原因特定が容易（cascading failureが起きない）
2. 並列実行でCI時間を短縮できる
3. どのテストから実行しても同じ結果（順序依存バグを防ぐ）

## 🤔 しかし現実はもっと複雑

### 独立テストの **コスト**

テストを完全に独立させるには、各テストが次のいずれかを持つ必要がある：

| 方式 | 仕組み | このプロジェクトでの可否 |
|------|--------|--------------------------|
| **A. Transaction rollback** | DBトランザクションでテストごとにロールバック | ❌ Playwrightでは無理（browser/server/DBが別プロセス） |
| **B. API直接呼び出しでsetup** | `beforeEach` で API 経由でデータ作成 | △ Next.js Server Actions中心で純粋APIが少ない |
| **C. Prisma直接操作** | テスト内でPrismaクライアント | ❌ ADR-0012で技術的に不可と判断済み |
| **D. ユニークコードで衝突回避** | `ROLE_${timestamp}` で毎回別データ | ⚠️ ゴミデータ蓄積、要定期クリーンアップ |
| **E. Test-only APIエンドポイント** | `/api/test/reset` を環境変数でガード | ✅ 実装可能（新規コスト大） |
| **F. CRUD serial（現状）** | 同一データをcreate→update→delete で使い回す | ✅ 採用中 |

### CRUD serial は実は正当なパターン

**CRUD serial は E2E テストの世界では「User Journey Testing」「Scenario Testing」として認められた正当なパターン**：

- **Cypress** 公式ドキュメントも "Test user flows, not individual units" と推奨
- **Playwright** の `test.describe.serial` は公式に用意されている機能（教義に反するなら用意されない）
- 実際のユーザーは「作って、更新して、削除する」という流れで使うので、**テストがその流れを検証するのは自然**

## ⚖️ CRUD serial 方式の評価

### ✅ 強み
1. **実装コストが低い**：余計なインフラ不要
2. **ユーザーフローを自然にテスト**：「作成直後に詳細が表示される」のような遷移もまとめて検証できる
3. **データ重複不要**：同じ `ROLE901` を使い回すため、ユニーク制約の衝突がない
4. **ADR-0012の技術制約下では最適解**

### ⚠️ 弱点（認識しておくべきもの）
1. **Cascading failure**: chain途中が失敗すると以降はスキップされ、update/deleteが動くかどうか分からない
2. **失敗時のゴミデータ**: chainの途中で失敗すると `ROLE901` が残る → `pnpm e2e:seed` で再リシード必要
3. **デバッグが難しい**: 後半ステップの失敗が前半ステップの不完全な状態に起因する可能性
4. **並列性の損失**: 直列なので遅い（ただしCRUDテスト自体が少数なので影響は限定的）

## 💡 一般的な方式を参考にした改善提案

### 提案1: 失敗時の自己修復（afterAll クリーンアップ）

`test.describe.serial` に `test.afterAll` を追加して、chain途中で失敗しても確実にクリーンアップ：

```ts
test.describe.serial("作成・更新・削除テスト", () => {
  test.afterAll(async ({ request }) => {
    // テスト用APIで ROLE901 を削除（存在しなければ無視）
    await request.delete(`/api/test/cleanup/roles/${TEST_ROLE_CD}`);
  });
  // ... tests
});
```

**効果**: chain途中で失敗してもリシード不要に。ただしテスト用APIエンドポイントの実装コストあり。

### 提案2: ユニークコード生成（衝突回避）

```ts
const TEST_ROLE_CD = `ROLE9${Date.now().toString().slice(-2)}`;
```

**効果**: 失敗時のゴミデータが残っても次の実行に影響しない。ただし**累積**するのでcron等で定期削除が別途必要。

### 提案3: 細かいserial分割 ⭐

長い1chainではなく、関心事ごとにchain分割：

```ts
// ライフサイクルchain
test.describe.serial("作成→更新→削除", () => {
  test("作成できる");
  test("更新できる");
  test("削除できる");
});

// ステータス管理chain（別データコード）
test.describe.serial("無効化→有効化", () => {
  // TEST_ROLE_CD_B で実施
});
```

**効果**: 一部失敗でも他のchainは実行される。→ **この方針はADR-0020判断1として採用**（1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分、最大5テスト）。

### 提案4: DB状態変化なしの失敗系を並列・シードで実施 ⭐

「副作用」よりも「DB 状態変化」で分類し、状態変化しないテスト（削除制約違反・バリデーションエラー・検索）は並列実行＋シードデータを使う：

```ts
// 並列実行OK（シードデータを使った失敗系テスト）
test("下位役割がある役割は削除できない") // ROLE001 で試行
test("存在しない役割で404")
test("使用中の役割は削除できない") // ROLE005 で試行

// serial（成功系のみ）
test.describe.serial(() => {
  test("作成→更新→削除")
});
```

**効果**: 並列度が上がり、失敗系のテストが互いに独立する。→ **この方針はADR-0020判断2として採用**（DB状態変化の有無で4分類）。

## 🎯 結論

**現状の「CRUD serial」は維持**。理由：

1. 技術制約（ADR-0012: Prisma 7.x ESM/CJS問題）下で最適
2. 一般的なE2E業界でも User Journey Testing として認められている
3. 移行コストに見合う明確なメリットが他の方式にない

ただし以下を追加してより堅牢に：

| 優先度 | 改善項目 | ADR-0020での扱い |
|--------|----------|-------------------|
| 🔴 高 | **提案3: serial の細かい分割** | 判断1として標準化 |
| 🟡 中 | **提案4: 失敗系は並列＋シード** | 判断2として標準化（独自シード9NN帯） |
| 🟢 低 | **提案1: afterAll クリーンアップ** | 未採用（リシードで十分） |

## 重要な教訓

- **技術制約を議論の出発点にする**: 「理想はA、でも制約XでAは不可、なのでB」と論理を組むと、単なる好み論争にならない
- **「教科書」を絶対視しない**: `test.describe.serial` のような公式機能が存在するということは、業界もserialを正当な選択肢として認めている
- **「副作用」より「DB状態変化」**: 分類語彙の選び方で議論の精度が変わる。「削除試行（失敗期待）」は副作用を起こそうとするがDBは不変 — 「副作用」では扱えないが「DB状態変化」なら明確に分類できる
- **独自シード帯の予約（xxx9NN）**: 共通シード（001-0XX）と分離することで、ドメインエラーテスト用のシードを他テストから保護できる

## 参考

- `docs/adr/0012-e2e-test-db-separation-strategy.md` — DB分離・CRUD serial 方針の技術的根拠
- `docs/adr/0020-e2e-test-composition-and-execution-strategy.md` — 本ノートの知見を踏まえた構成・実行戦略の決定
- `.claude/skills/create-e2e-test/SKILL.md` — 実装者向けチェックリスト
- Playwright: https://playwright.dev/docs/test-parallel#serial-mode
