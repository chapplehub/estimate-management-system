# ADR-0043: 取引先は CTI（基底テーブル継承）を廃し、サブタイプ平坦化で「集約 = 1 テーブル」にする

| 項目       | 値         |
| ---------- | ---------- |
| ステータス | 採用       |
| 起票日     | 2026-06-11 |
| 最終更新日 | 2026-06-11 |

## コンテキスト

得意先（Customer）と納品先（DeliveryLocation）は、`companies` 基底テーブルにサブタイプテーブル（`customers` / `delivery_locations`）が 1:1 でぶら下がる **CTI（Class-Table Inheritance）** で永続化されている。`CompanyType` 判別子で型を区別する。

ただしドメイン層に `Company` エンティティ／集約は**存在しない**（あるのは値オブジェクト `CompanyId` / `CompanyCode` / `CompanyName` のみ）。各サブタイプが自分の `company` 行を 1:1 で所有する単一集約であり、`CustomerMapper.toDomain` は `companies` 行と `customers` 行を join して 1 個の `Customer` エンティティに再構築している。つまり CTI は**純粋に永続化の都合**で、ドメインに共有概念としての取引先は無い。

Issue #301（ADR-0039: 楽観ロックの横断導入）の customer 段階展開（#303）に着手したところ、この CTI のいびつさが表面化した。楽観ロックトークン `version` は集約ルートの identity 行＝サブタイプ（`customers`）に置かれるが、可変状態（`name` / 住所 / `isActive`）の大半は基底（`companies`）にある。Prisma の `updateMany`（条件付き UPDATE に version を足すために必須。ADR-0039 細目6）は**ネストリレーション書き込みを受け付けない**ため、単一テーブル集約（estimate / department / role）で確立した「条件付き UPDATE 1 文」がそのまま当たらず、customer だけ estimate 型の 2 テーブルトランザクションを要する。

そこで「CTI は何を買っているのか」を調査した結果、**計測可能な利益をほぼ生んでいない**ことが判明した。

| CTI を正当化する典型理由        | 実態                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 取引先を多態参照               | ❌ `Estimate` は `customerId` と `deliveryLocationId` を別々の必須 FK で持つ。`companyId` を多態参照する箇所はゼロ。   |
| 型横断の一覧／検索             | ❌ 各 QueryService が `type` で必ず片方に絞る。判別子の唯一の用途が「共有したものを元の型に戻す」こと。                |
| `code` の型横断一意性（業務）   | ⚠️ ドメインの重複チェックは Repository 経由で**型内のみ**。`companies.code @unique` はそれより厳しく、潜在バグの芽。   |

加えて、(1) CTI 採用を正当化する ADR は存在せず（暗黙の設計判断）、(2) 楽観ロックの CTI 構造への変換はまだ 1 件もマージされていない（estimate / department / role は全て単一テーブル）。**埋没コストが最小の分岐点**である。

## 検討した選択肢

### A. CTI を維持し、customer に 2 テーブルトランザクションで楽観ロックを適用（不採用）

モデルを触らず、`$transaction` 内で「`customers` を `WHERE id AND version` の条件付き `updateMany`（version +1）→ `companies.update`」と更新する。データ移行は不要だが、いびつさ（version と state の分離）が残り、同じ特殊パターンを delivery_location でも書く必要がある。CTI が利益を生んでいない以上、複雑さに見合う対価が無い。

### B. サブタイプ平坦化（採用）

`companies` を廃止し、共通列（`code` / `name` / 住所 / 連絡先 / `isActive`）を `customers` と `delivery_locations` に取り込む。`companyId` FK・`CompanyType` 判別子は削除。各テーブルが「集約 = 1 テーブル」になり、楽観ロックは ADR-0039 の単一文 `updateMany` がそのまま適用できる。`code` の一意性は自然にテーブル単位（型内）となり、ドメインの重複チェックの前提と一致する。

### C. `Company` を独立集約に昇格（不採用）

CTI を明示的に 2 集約へ分割する。だが `name` / 住所 / `isActive` は得意先と**同時に更新されるべき**属性であり、集約を跨ぐと 2 トランザクション・2 トークンになり「得意先名の変更」が集約境界を越える。本 ADR が解こうとしている問題を最も悪化させる。

## 決定

**取引先は CTI を廃し、サブタイプ平坦化する。`companies` テーブルと `companyId` FK・`CompanyType` 判別子を削除し、共通列を `customers` / `delivery_locations` に取り込んで「集約 = 1 テーブル」にする。`code` の一意性は型内（テーブル単位 `@unique`）とする。`version` は各サブタイプ（= 集約ルート）に同居し、ADR-0039 の条件付き `updateMany` 1 文をそのまま適用する。**

## 根拠

- **CTI の対価がゼロだと計測できた**: 多態参照・型横断クエリ・型横断一意のいずれも使われておらず、判別子の唯一の用途が「共有を元の型に戻す」こと。共有の利益を享受せず、毎回の join／ネスト書き込み／version と state の分離というコストだけを払っていた。
- **今が埋没コスト最小の分岐点**: CTI 構造への楽観ロック変換は 1 件もマージされていない。ここで平坦化すれば、customer・delivery_location の楽観ロックは単一テーブルの自明な形に落ちる。CTI のまま進めると、いびつな 2 テーブルパターンを 2 サブドメインに書き、後で平坦化する際に両方捨てることになる。
- **ドメインの実態に永続化を合わせる**: ドメインに共有取引先概念は無い。`code` 型内一意はドメインの重複チェックの前提と一致し、CTI が課していた型横断一意（潜在バグの芽）を解消する。
- **同時更新の保証はむしろ強まる**: 平坦化後は集約 = 1 行となり、`name` / `isActive` 等が単一行の更新で原子的に書ける。選択肢 C のように集約を割ると失われる性質を、平坦化は構造的に保証する。

## 影響

- **スキーマ移行**: `customers` / `delivery_locations` に共通列を追加 → `companies` から join でバックフィル → `companies` テーブル・`companyId` FK・`CompanyType` enum を drop。`Estimate` の FK（`customerId` / `deliveryLocationId`）はサブタイプ PK を指すため**無変更**。
- **挙動変更（一意性）**: `code` の一意性が型横断 → 型内に変わる。得意先 `C001` と納品先 `C001` が共存可能になる（ADR で明示的に許容。接頭辞 C/D の別名前空間規約とも整合）。グローバル一意が将来必要になった場合はアプリ層横断チェックを別途設ける。
- **値オブジェクト**: `CompanyId` VO と `CompanyType` enum は廃止。`CompanyName` / `CompanyCode` / `Address` 等の共通 VO は得意先・納品先の両サブドメインで継続共有する。
- **影響範囲**: customer / delivery-location の mapper・query・repository・コード重複チェックのみ。`companies` を読む他経路は存在しない（確認済み）。
- **Issue #303 の再スコープ**: 本 ADR に伴い #303 を「customer への楽観ロック適用」から「**取引先モデル平坦化（customer + delivery_location）＋ customer 楽観ロック**」へ拡張する。平坦化は `companies` を両サブタイプが参照するため 2 サブドメインに同時に触れざるを得ない。delivery_location は当面 `save` を維持し、その楽観ロック化は後続イシューで扱う。
- 関連: ADR-0039（楽観ロック。平坦化により customer は単一文パターンに単純化される）、ADR-0027（集約境界）、ADR-0019/0021（VarChar・CHECK 制約。移行列にも踏襲する）。
