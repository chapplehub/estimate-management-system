# Issue #250: E2Eテスト作成スキルの整備 — 実装計画

## Context

E2Eテストを作成する際に暗黙のうちに従っているルール・考え方が複数存在するが、明文化されておらず属人的になっている。これを整理して：

1. **ADRを作成**して設計判断の根拠を残す
2. **E2Eテスト作成スキル（`/create-e2e-test`）** を作り、今後新機能のE2Eテストを作成する際の標準パターンとする

現状、ルールは以下の複数箇所に散在：
- Issue #250 本文（リシード前提・serial化・複合条件等の要件）
- ADR-0012（E2Eテスト専用DB環境）
- ADR-0017（テーブルセル特定はヘッダー名ベース）
- 最近実装されたe2eテスト群（roles/products/customers/delivery-locations）の暗黙パターン

本タスクでは、これらを**Testing基盤の設計判断としてADRに統合**し、実装者向けの**スキル**を作ることで、今後のE2Eテストの品質を揃える。

---

## 決定済み設計判断（ここまでの議論で合意）

### 判断A: CRUD serialは維持する
- 技術制約（ADR-0012: Prismaクライアント直接操作不可）下で最適
- User Journey Testing として一般的にも認められたパターン
- **chain途中で失敗した場合はリシード（`pnpm e2e:seed`）で対応**（高速なのでクリーンアップAPIは不要）

### 判断B: serial chain の粒度基準
「**1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分**」

**同じchainに入れる条件（すべて満たす）**:
1. 同じテストデータ（同じCD）を使い回せる
2. 同じ関心事カテゴリ（ライフサイクル/ステータス/サブリソース/リレーション）
3. ユーザーの典型的な利用フローに沿った順序

**別chainに分離する条件（いずれか該当）**:
1. 別のテストデータが必要（区分違い、権限違い）
2. 別の関心事カテゴリ（例: ステータス管理 vs ライフサイクル）
3. chain サイズが 5 を超える（blast radius 抑制）

**具体ルール（既存パターンの明文化）**:
- ステータス管理（有効化/無効化）は独立chain
- データ区分ごとに独立chain（個別商品 vs セット商品）
- 権限ごとに独立 `test.describe`（管理者 vs 一般ユーザー）
- サブリソース操作は独立ファイル（例: `products-relations.e2e.ts`）

**既存テストへの遡及適用はしない**。今後書くものから適用。

### 判断C: 成功系はserial、失敗系はserial外で並列

| テストタイプ | 実行方式 | 使用データ |
|--------------|----------|------------|
| 成功系CRUD | `test.describe.serial` で直列 | **新規データ**（xxx901, xxx902 をテスト内で作成） |
| ドメインエラー（FK制約・使用中・下位レコードあり等） | serial外で並列 | **独自シード**（seed.e2e.ts の xxx9NN 帯、判断G参照） |
| バリデーションエラー（空欄登録等） | 並列実行（serial外） | 共通シードデータ（DB到達しない） |
| 重複エラー（既存コードで新規登録試行） | 並列実行（serial外） | 共通シードデータの既存コード（DB不変） |
| 権限チェック・閲覧系 | 並列実行（serial外） | 共通シードデータ |
| 検索・一覧フィルタ | 並列実行（serial外） | 共通シードデータ |

### 判断G: DB状態変化の有無でデータ戦略を分ける（論点1）

**原則**: 「テストが DB 状態を変化させるか否か」でデータ戦略を決定する。

**用語**: 「副作用」ではなく「DB状態変化」を基準にする。削除試行が失敗するテストは「試行」という意味では副作用があるが、DB は不変なので「DB状態変化なし」に分類する。

#### 分類表

| テストタイプ | DB状態変化 | データ戦略 | 根拠 |
|---|---|---|---|
| 成功系CRUD（create/update/delete/activate/deactivate） | あり | 新規データ（テスト内構築） | シード保護最優先 |
| 簡易エラー（validation / duplicate / permission） | なし | 共通シード | 準備コスト不要、テスト失敗リスク低 |
| ドメインエラー（FK制約 / 使用中 / 下位レコードあり等） | なし | **独自シード**（seed.e2e.ts 拡張） | 他テスト変更の影響を隔離 + 準備時間削減 |
| 検索・閲覧 | なし | 共通シード | 準備不要 |

#### 簡易エラー vs ドメインエラーの境界

**判別基準**: 「関連データの読み込みが必要か」

- **簡易エラー**: UI層 / zod / 権限ミドルウェアで検出（DB問い合わせなし or 単一レコードの unique チェックのみ）
  - validation（必須項目、型不正）
  - 重複（unique制約 — DBに到達するが不変）
  - 権限（リクエスト時点で拒否）
- **ドメインエラー**: ドメイン層のビジネスルール検証で検出（関連データを読み込んで判定）
  - FK制約違反（下位レコードあり削除）
  - 使用中チェック（assigned等）
  - ステータス遷移違反（例: 完了済み注文は変更不可）

#### 独自シードの命名規則

**CD（識別子）**: シンプルに `<prefix>9NN` のみ（汎用シードは 001-0XX 帯、テスト専用は 9NN 帯で予約）

- 例: ROLE901, ROLE902, C901, PRD901, D901
- エンティティ別にCD桁数制約があるため、CD にシナリオ名は埋め込まない

**シナリオの意味**: `seed.e2e.ts` のコメント + `name/description` フィールドで表現

```ts
// seed.e2e.ts 内の実例
// ROLE901/902: 下位役割あり削除テスト用（ドメインエラー: HAS_CHILDREN）
{ roleCd: "ROLE901", roleName: "E2E専用_下位役割あり親" ... }
{ roleCd: "ROLE902", roleName: "E2E専用_ROLE901の子" ... }

// C901/D901: 納品先あり削除テスト用（ドメインエラー: HAS_DELIVERY_LOCATION）
{ customerCd: "C901", customerName: "E2E専用_納品先あり得意先" ... }
{ deliveryLocationCd: "D901", parentCustomerCd: "C901" ... }
```

**テストコード側**: 定数で意味を宣言して参照

```ts
// xxx-crud.e2e.ts 内
const ROLE_HAS_CHILDREN = "ROLE901"; // seed.e2e.ts: 下位役割あり削除テスト用

test("下位役割がある役割は削除できない", async ({ page }) => {
  await page.goto(`/roles/${ROLE_HAS_CHILDREN}`);
  // 削除試行 → エラー（DB不変）
});
```

#### シードデータ拡張の条件

- **既存データは変更しない**（Issue #250 の原則）
- 独自シードは「**failure-only テスト**」のために用意する（DB不変が前提）
- 汎用パターンとして使えるなら複数テストで共有OK（1テスト専用にしない）

#### 遡及適用

**既存テストへの遡及適用はしない**。現状の ROLE001/ROLE005/C001 等を使った削除試行テストは維持。新規テストから本判断を適用する。

### 判断D: 一覧画面の検索条件テストは「主要は個別 + parametrize 併用」（論点2）

**個別テスト化するもの**:
- 検索ロジックが異なる条件（完全一致 vs 部分一致 vs ドロップダウン vs ブール）の代表例を1つずつ
- **複合条件テストは必ず個別**

**parametrize 対象**:
- 同じロジックを共有する条件群（例: 複数カラムの完全一致）

**理由**:
- 検索ロジックのバグはロジック種別が異なる箇所で起きる
- 同ロジックのUIラベル紐付けバグは1つのparametrizeで十分
- 複合条件は AND/OR のバグが起きうるため個別必須

### 判断E: ファイル分割の基準（論点4）

- **2ファイル基準**（デフォルト）: `xxx-list.e2e.ts` + `xxx-crud.e2e.ts`
- **3ファイルに拡張**: 詳細画面で**ナビゲーション系**（パンくず・親子リンク・404）がある場合は `xxx-detail.e2e.ts` を分離
- **独立ファイル追加**: サブリソース操作（例: 周辺商品モーダル、セット構成）は独立（`xxx-relations.e2e.ts` など）

### 判断F: CRUD直後の存在確認（論点5）

- **作成直後**: 一覧検索で新規レコードが見つかることを確認
- **削除直後**: 一覧検索で該当レコードが見つからないことを確認
- 既存の `roles-crud`、`customers-crud` のパターンを標準化

---

### 判断H: 権限テストの扱い（論点6-auth）

#### 基本方針

- **権限差異がある機能**（例: 役割・商品は管理者のみ編集可能）→ 管理者／一般ユーザー両方で `test.describe` を作成
- **権限差異がない機能**（例: 得意先・納品先は全ユーザーCRUD可能）→ 管理者テストのみ + 一般ユーザーの簡易 serial chain を1つ書いて回帰を防ぐ

#### 一般ユーザー簡易 chain の範囲（最小版）

- **ステップ**: 作成 → 削除 の2ステップのみ
- 更新は含めない（管理者側で検証済みのため）
- 目的: 一般ユーザーでも CRUD 操作が最低限通ることの回帰検知

#### 権限エラーテストの扱い（必須）

権限差異がある機能では、以下の権限エラーテストを**必須**とする:

- 一般ユーザーが管理者専用画面（例: `/xxx/new`）へ直接アクセス → `/signin?reason=forbidden` リダイレクト
- 一般ユーザー用の閲覧画面でも編集系ボタン（更新・削除）が表示されない
- **目的**: サーバ側の認可チェック回帰検知（フロント側ナビ制御だけでは不十分）

遡及適用なし。新規テストから必須とする。

#### ファイル分割ルール

**原則**: `xxx-crud.e2e.ts` に両ユーザーの `test.describe` を含める（同一ファイル主義）

**300行超での分離判断**:

ファイルが300行を超えた時点で分離を検討する。数値は"きっかけ"であり、最終判断は凝集度（ライフサイクル・権限・ステータス）で決める。

**分離順序**（上から順に検討）:

1. **権限テスト分離**: `xxx-auth.e2e.ts` に一般ユーザー chain + 権限エラーテストを集約
2. **chain種別分離**: `xxx-status.e2e.ts` にステータス管理 chain を分離（状態遷移が多い機能向け）
3. **データ次元分離**: 機能内のデータ区分で分割（例: `products-individual-crud.e2e.ts` / `products-set-crud.e2e.ts`）

遡及適用なし。既存の `products-crud.e2e.ts`（肥大済み）は現状維持でも良い。

### 判断I: スキルは簡潔版（ルール列挙 + ADR参照）（論点6-粒度）

- スキルは「何をすべきか」のチェックリスト中心
- 設計判断の根拠は ADR-0012/0017/0020 を参照
- 重要ヘルパー（`waitForListReady`, `getColumnIndex`）は**フルコード掲載**（毎回コピペする標準パターン、共通化しない）
- それ以外（セレクタ優先順位・検索粒度など）は**ルール列挙**で済ませる

### 判断J: コーディング規約（論点6-細部）

- **型注釈スタイル**: `import { type Page, expect, test } from "@playwright/test"` の named import を標準とする。インライン型 `import("@playwright/test").Page` は使わない
- **auth storageState パス**: magic string をそのまま記述（`"playwright/.auth/user.json"` のように）。定数化はしない（パス変更時は auth.setup.ts / playwright.config.ts との同期が必要なため、テスト側定数化しても保守コストは下がらない）
- **共通ヘルパー配置**: 各 e2e ファイルにコピペで設置する（判断I と整合）。共通ヘルパーファイルは作らない

---

## 成果物

### 成果物1: ADR-0020「E2Eテストの構成・実行戦略」

**ファイル**: `docs/adr/0020-e2e-test-composition-and-execution-strategy.md`

**目的**: ADR-0012（DB環境）と ADR-0017（セル特定）を補完し、**E2Eテスト全体のテスト戦略** を明文化する。

**含める設計判断**（5つ）:

| # | 判断 | 内容 |
|---|------|------|
| 判断1 | serial chain の粒度（判断B） | 1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分 / chain最大5テスト |
| 判断2 | テスト種別ごとの実行方式と使用データ（判断C + G） | 成功系CRUD→新規データ（serial）/ ドメインエラー→独自シード（9NN帯）/ 簡易エラー・検索→共通シード |
| 判断3 | 一覧検索の粒度（判断D） | 主要ロジック種別ごと個別 + 同ロジックはparametrize / 複合条件は必ず個別 |
| 判断4 | ファイル分割の基準（判断E） | 2ファイル基本 / detail画面にナビゲーション系ありなら分離 / サブリソースは独立 |
| 判断5 | 権限差異テストの扱い（判断H） | 権限差異ある機能のみ両ユーザーでテスト |

**構成**（既存ADR形式に従う）:

```markdown
# ADR-0020: E2Eテストの構成・実行戦略

## コンテキスト
ADR-0012 で E2Eテストの DB 環境と、副作用テストの直列化（test.describe.serial）
方針を決定した。その後、roles/products/customers/delivery-locations の実装を
経て、以下の暗黙パターンが定着したが明文化されていない：
（上記5つの判断領域を列挙）

## 検討した選択肢
（判断1〜5を個別の「判断」セクションとし、各々で採用・不採用の選択肢を記載）

### 判断1: serial chain の粒度
#### A. 全CRUDを1つのserialにまとめる（不採用）
#### B. 粒度基準「1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分」（採用）

### 判断2: テスト種別ごとの実行方式と使用データ
#### A. すべてserialで実行、シードデータ優先（不採用）
#### B. 副作用あり=serial+新規データ / 副作用なし=並列+シードデータ（不採用）
  注: 「副作用」の語彙曖昧性により「削除試行」の扱いがブレる
#### C. DB状態変化の有無で4分類（採用）
  - 成功系CRUD（DB変化あり）→ serial + 新規データ（テスト内構築）
  - ドメインエラー（DB不変、関連データ読込あり）→ 並列 + **独自シード**（seed.e2e.ts 9NN帯）
  - 簡易エラー（DB不変、validation/duplicate/permission）→ 並列 + 共通シード
  - 検索・閲覧（DB不変）→ 並列 + 共通シード

### 判断3: 一覧検索の粒度
#### A. 全条件を個別テスト（不採用）
#### B. parametrize で一括（不採用）
#### C. 主要条件は個別 + parametrize 併用（採用）

### 判断4: ファイル分割の基準
#### A. 常に 1 ファイル（不採用）
#### B. 2ファイル基本 + 必要時に分離（採用）

### 判断5: 権限テストの扱い
#### A. 全機能で両ユーザーテスト（不採用）
#### B. 権限差異ある機能のみ両ユーザーテスト（採用）
  - 権限差異あり → 両ユーザー `test.describe` + 権限エラーテスト必須
  - 権限差異なし → 管理者のみ + 一般ユーザー簡易 chain（作成→削除の2ステップのみ）
  - ファイル分割: 同一ファイル基本、300行超で分離検討（順序: 権限 → chain種別 → データ次元）

## 決定
上記1〜5の判断を採用する。既存テストへの遡及適用はしない。

## 根拠
- blast radius の最小化（chain分割）
- シードデータの保護（成功系CRUD=新規データ）
- 並列性の確保（DB状態変化なしテストをserial外）
- ドメインエラーの隔離（独自シードで他テスト変更の影響を受けない）
- 保守性（検索条件のロジック種別ごとに個別テスト）
- ユーザー体験に沿った構造（ファイル分割）

## 影響
- 新規E2Eテストは本ADRに従う
- スキル `/create-e2e-test` でこれらのパターンを自動適用
- ドメインエラーテスト用に seed.e2e.ts へ独自シード（xxx9NN帯）を追加する運用
- 既存シードデータ（001-0XX帯）は変更しない
```

### 成果物2: E2Eテスト作成スキル `/create-e2e-test`

**ファイル**: `.claude/skills/create-e2e-test/SKILL.md`

**目的**: 新機能のE2Eテストを作成する際のチェックリスト・標準ヘルパー・セレクタ優先順位を提供する。**簡潔版**（判断I）で、設計判断の根拠は ADR-0012/0017/0020 を参照。

**構成**:

```markdown
---
name: create-e2e-test
description: Playwright E2Eテスト作成パターン。Use when E2Eテストファイル(*.e2e.ts)の新規作成時。ADR-0012/0017/0020のルールを適用する
user-invocable: true
---

# E2E Test Creation Patterns

詳細な設計判断の根拠は ADR-0012/0017/0020 を参照。
このスキルは実装者向けのチェックリスト。

## 1. 前提
- pnpm e2e で常にリシードされる → テストは常にシードデータ前提で開始
- スキーマ変更時は pnpm e2e:setup
- 詳細: ADR-0012

## 2. ファイル構成（ADR-0020 判断4）
- **2ファイル基本**: xxx-list.e2e.ts + xxx-crud.e2e.ts
- **3ファイルに拡張**: detail画面にナビゲーション系（パンくず/親子リンク/404）があれば xxx-detail.e2e.ts
- **独立ファイル追加**: サブリソース操作（周辺商品モーダル、セット構成等）

## 3. テスト種別と実行方式（ADR-0020 判断2）
| 種別 | DB状態変化 | 実行方式 | 使用データ |
|------|---|----------|------------|
| 成功系CRUD・ステータス変更 | あり | test.describe.serial | 新規データ (xxx901/xxx902 をテスト内構築) |
| ドメインエラー（FK制約・使用中・下位レコードあり等） | なし | serial外で並列 | **独自シード** (seed.e2e.ts xxx9NN帯) |
| 簡易エラー（validation / duplicate / permission） | なし | serial外で並列 | 共通シード |
| 検索・閲覧 | なし | serial外で並列 | 共通シード |

**分類の判別基準**:
- 成功系 = DBに書き込みが成功する → 新規データで構築
- ドメインエラー = 関連データを読み込んで判定（FK / 使用中など）→ **独自シード**を seed.e2e.ts に用意
- 簡易エラー = UI / zod / 権限ミドルウェアで検出（DB不変）→ 共通シード

## 4. serial chain の粒度（ADR-0020 判断1）
- 1 chain = 1 ライフサイクル × 1 関心事 × 1 データ区分
- chain最大5テスト
- ステータス管理（有効化/無効化）は独立chain
- データ区分ごとに独立chain（個別商品 vs セット商品）
- 権限ごとに独立 test.describe

## 5. テストデータ命名規則
- **共通シード**: `xxx001` 〜 `xxx0XX` 帯（検索・閲覧・簡易エラー用）
- **テスト専用**: `xxx9NN` 帯
  - 成功系CRUD: `xxx901`（管理者用）/ `xxx902`（一般ユーザー用）をテスト内で作成
  - ドメインエラー用独自シード: `xxx9NN`（seed.e2e.ts に事前定義、CD にシナリオ名は入れない）
- エンティティ別の桁数例: ROLE901（7桁）、PRD901（6桁）、C901（4桁）、D901（4桁）
- テスト側では `const ROLE_HAS_CHILDREN = "ROLE901"` のように定数化して意味を明示

## 6. 標準ヘルパー（コピペ用）

**配置方針**: 各 e2e ファイルにそのままコピペして使う（共通ヘルパーファイルは作らない）。
**型注釈**: `import { type Page, expect, test } from "@playwright/test"` の named import を前提とする。

### ハイドレーション待機
\`\`\`ts
import { type Page, expect, test } from "@playwright/test";

async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "xxx管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}
\`\`\`

### ヘッダー名ベースのカラム特定（ADR-0017）
\`\`\`ts
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}
\`\`\`

## 7. セレクタ優先順位
1. `getByRole("heading"/"link"/"button", { name })` — アクセシビリティロール優先
2. `getByLabel("...")` — フォームフィールド
3. `#code-display` などID — 読み取り専用フィールド検証のみ

## 8. 検索テストの粒度（ADR-0020 判断3）
- 検索ロジックが異なる条件（完全一致/部分一致/ドロップダウン/ブール）は**個別テスト**
- 同ロジックを共有する条件は **parametrize**（for...of でループ）
- **複合条件は必ず個別テスト**

## 9. CRUD Serialの標準フロー
- 管理者 chain1（ライフサイクル）: 作成 → 詳細確認 → 更新 → 削除
- 管理者 chain2（ステータス管理）: 作成 → 無効化 → 有効化 → 削除（別データコード）
- 一般ユーザー chain: 作成 → 削除（簡易）
- **作成直後**: 一覧検索で新規レコードが見つかることを確認
- **削除直後**: 一覧検索で該当レコードが見つからないことを確認

## 10. 成功/エラー検証パターン
\`\`\`ts
// 成功トースト
await expect(page.getByText("xxxを登録しました。")).toBeVisible({ timeout: 10000 });

// エラー
await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
await expect(page).toHaveURL(/\/xxx\/new/); // URL不変

// 404
const response = await page.goto("/xxx/NONEXIST");
expect(response?.status()).toBe(404);
\`\`\`

## 11. 権限テスト（ADR-0020 判断5）

### 基本方針
- **権限差異がある機能のみ**両ユーザーでテスト
- 権限差異なし → 管理者テストのみ + 一般ユーザー簡易chain
- 一般ユーザーテスト: `test.describe` 内で `test.use({ storageState: "playwright/.auth/user.json" })` （magic string のまま記述、定数化しない）

### 一般ユーザー簡易 chain（最小版）
- **作成 → 削除 の2ステップのみ**（更新は含めない）
- 目的: 一般ユーザーでも CRUD 最低限が通る回帰検知

### 権限エラーテスト（必須）
権限差異がある機能では以下を必須とする:
- 一般ユーザーが `/xxx/new` 等の管理者専用画面に直接アクセス → `/signin?reason=forbidden` リダイレクト
- 一般ユーザー閲覧画面で更新・削除ボタンが非表示

### ファイル分割（権限観点）
- 原則: `xxx-crud.e2e.ts` 同一ファイルに両ユーザーの `test.describe`
- **300行超で分離検討**（凝集度で最終判断）
- 分離順序: (1) 権限テスト分離 `xxx-auth.e2e.ts` → (2) chain種別分離 `xxx-status.e2e.ts` → (3) データ次元分離（例: individual / set）

## 12. 詳細画面の dt+dd 検証
\`\`\`ts
const field = (label: string) => page.locator("dt", { hasText: label }).locator("+ dd");
await expect(field("商品コード")).toContainText(TEST_CODE);
\`\`\`

## 13. シードデータ追加（ADR-0020 判断2）
- **独自シード追加の対象**: ドメインエラーテスト（FK制約 / 使用中 / 下位レコードあり等）
- **追加ルール**:
  - CD は `xxx9NN` 帯（例: ROLE901, C901）
  - `seed.e2e.ts` 内にコメントでシナリオを明示（例: `// ROLE901/902: 下位役割あり削除テスト用`）
  - `name/description` に `E2E専用_<用途>` プレフィックスを付ける
- **既存データ構造は変更しない**（Issue #250 原則）
- **failure-only テスト用**（DB不変が前提）。成功系テストで書き換える用途には使わない
- 汎用パターンとして複数テストで共有OK（1テスト専用にしない）

## 14. 実行コマンド
- `pnpm e2e` — 全テスト（リシード込み）
- `pnpm e2e:setup` — DB初期化（スキーマ変更時）
- `pnpm e2e:seed` — リシードのみ
- `pnpm e2e -- --grep "xxx"` — 特定パターンのみ実行

## 15. chain 途中失敗時
テストデータが残留した場合は `pnpm e2e:seed` で再シード。
```

---

## 実装手順

### Step 1: ADR-0020 の作成
- **対象ファイル**: `docs/adr/0020-e2e-test-composition-and-execution-strategy.md`
- **追記**: `docs/adr/INDEX.md` の「テスト基盤」セクションに ADR-0020 のリンクを追加
- **コミット**: `docs: ADR-0020 E2Eテストの構成・実行戦略を追加`

### Step 2: スキル `/create-e2e-test` の作成
- **対象ファイル**: `.claude/skills/create-e2e-test/SKILL.md`
- **コミット**: `feat: E2Eテスト作成スキルを追加`

### Step 3: 検証
- ADR番号の重複がないこと（0020 が未使用を確認済み）
- INDEX.md のリンクが正しいこと
- スキル frontmatter の description が `/skills` コマンドで期待通り表示されること
- 既存の e2e テストとの整合性（recent実装がスキルのパターンに合致していること）

---

## 主要参照ファイル

| ファイル | 用途 |
|----------|------|
| `docs/adr/TEMPLATE.md` | ADRテンプレート |
| `docs/adr/INDEX.md` | ADR索引（追記必要） |
| `docs/adr/0012-e2e-test-db-separation-strategy.md` | DB環境の設計判断（参照） |
| `docs/adr/0017-e2e-table-cell-selector-strategy.md` | セル特定の設計判断（参照） |
| `.claude/skills/testing-backend/SKILL.md` | スキルの書式参考 |
| `prisma/seed-e2e.ts` | E2E用シードデータ |
| `playwright.config.ts` | Playwright 設定 |
| `src/app/(features)/customers/customers-*.e2e.ts` | 3ファイル分割の実例 |
| `src/app/(features)/roles/roles-*.e2e.ts` | 2ファイル分割の実例 |
| `src/app/(features)/products/products-*.e2e.ts` | 4ファイル分割（relations独立）の実例 |

---

## 検証方法

### ADR関連
```bash
# ADR番号の重複確認
ls docs/adr/0020-*.md   # 既存なし確認

# INDEX.md の更新確認
grep "0020" docs/adr/INDEX.md
```

### スキル関連
```bash
# スキルファイルの配置確認
ls .claude/skills/create-e2e-test/SKILL.md

# frontmatter の検証（name/description/user-invocable）
head -10 .claude/skills/create-e2e-test/SKILL.md
```

### 整合性確認（人手）
- ADR-0020 の内容が、既存 e2e テスト（roles/products/customers/delivery-locations）と矛盾しないこと
- スキルの記述に従って書かれた e2e テストが、既存テストと同じパターンになること
