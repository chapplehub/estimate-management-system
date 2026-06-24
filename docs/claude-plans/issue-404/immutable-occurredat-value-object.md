# Issue #404: 見積申請ドメインの不変イベントVOで Date を防御コピーするか統一方針を決める — 実装計画

## 概要

estimate サブドメインの不変イベントVO（`StepApproval` / `StepRejection` / `ApplicationWithdrawal`）が
発生日時 `occurredAt: Date` を入口（`create` 引数）・出口（getter）の両方で内部参照のまま共有しており、
呼び出し側の `Date` 変異により「不変であるはずのイベント発生日時」と `equals` の結果が事後に変わりうる。

これを **epoch ミリ秒を内部表現とする不変VO `OccurredAt`** でラップして解決する。raw `Date` をドメインAPIから
締め出し、`Date` ↔ VO の変換を infra Mapper（`from`）とドメインの現在時刻取得（`now`）の2点に局所化する。
方針は ADR-20260624-8f5 に記録済み。

本 issue のスコープは `occurredAt`（3イベントVO）の先行適用。業務日付（`estimateDate` / `deadline`）は
別概念として #454（優先度 low）へ分離、監査列（`createdAt` / `updatedAt`）は対象外。

## 設計判断

grilling（/grill-with-docs）で確定済み。以下はすべて合意済みの選択。

### 解決方針
- A. 防御コピー（境界ごとに `new Date(d.getTime())`）
- B. 不変ラッパーVOで raw Date を締め出す
- C. 何もしない（入力側の不変条件に依拠）
- **採用: B**。理由: number の値セマンティクスで共有が原理的に発生せず、防御コピーの撒き忘れという失敗モードが消える。ADR-0027（防御コピー忌避）と整合。VO 文化（ADR-0022/0024/0026）の延長。

### VO の粒度
- **採用: `occurredAt`（instant）1本に絞る**。理由: 起票の核心は発生日時。業務日付は date-only の別概念のため同一VOに束ねない。

### 配置場所
- A. estimate サブドメイン内 / B. shared 昇格
- **採用: A（estimate 内）**。理由: 現状の使い手は estimate の3イベントVOのみ。投機的 shared 昇格は YAGNI。実需が出てから昇格（後付けコスト低）。

### 内部表現
- A. epoch ミリ秒の `number` / B. `Date` 保持＋境界で防御コピー
- **採用: A（epoch millis）**。理由: number は不変プリミティブで値渡し。可変オブジェクトを VO 内に持たないため共有が成立しない。instant は TZ 非依存で意味論とも整合。

### 名前・公開API面
- **採用: `OccurredAt`**。API: `from(date: Date)` / `now()` / `equals(other)` / `toDate()`。
- raw `Date` getter は**設けない**（経路2を封鎖）。`toDate()` は毎回 `new Date(millis)` でコピーを返す。

### イベントVO の境界
- X. `create` は Date 受け・getter も Date のまま / Y. 端から端まで `OccurredAt`
- **採用: Y**。理由: ドメインエンティティ（`EstimateApplication`）まで含め raw Date を締め出す。変換点を Mapper の `from` と `OccurredAt.now()` の2点に集約。ドメインの現在時刻は `OccurredAt.now()` に寄せる（`new Date()` は既存 `Estimate` でも使用済みの前例あり、purity 方針は新たに崩さない）。

### 適用範囲（段階移行）
- `occurredAt`（3イベントVO）先行適用。`estimateDate` / `deadline` → #454。`createdAt` / `updatedAt` → 対象外。

### ADR 起票
- **起票済み: ADR-20260624-8f5**（新採番方式 YYYYMMDD-sss 準拠、INDEX 追記済み）。

## ステップ

### Step 1: `OccurredAt` VO の新規作成（テスト先行）
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/approval/OccurredAt.ts`（新規）
  - `src/server/subdomains/estimate/domain/values/approval/__tests__/OccurredAt.test.ts`（新規）
- 作業内容:
  - 内部表現 `private readonly _epochMillis: number`。コンストラクタは private。
  - `static from(date: Date): OccurredAt`（`date.getTime()` を取り出す。入口で raw Date を捨てる）
  - `static now(): OccurredAt`（`new Date().getTime()`）
  - `equals(other: OccurredAt): boolean`（epoch 数値比較）
  - `toDate(): Date`（`new Date(this._epochMillis)` で毎回新インスタンス）
  - テスト: `from` で渡した Date を後から変異させても VO が不変（経路1）、`toDate()` の戻り値を変異させても VO が不変（経路2）、`equals` の同値/非同値、`now` の生成。
- コミットメッセージ: `feat: 発生日時の不変VO OccurredAt を追加（epoch millis 内部表現）`

### Step 2: 3イベントVO を `OccurredAt` で話すよう改修
- 対象ファイル:
  - `src/server/subdomains/estimate/domain/values/approval/StepApproval.ts`
  - `src/server/subdomains/estimate/domain/values/approval/StepRejection.ts`
  - `src/server/subdomains/estimate/domain/values/approval/ApplicationWithdrawal.ts`
  - 各 `__tests__` の追従
- 作業内容:
  - 内部保持を `_occurredAt: OccurredAt` に変更。`create` の引数を `occurredAt: OccurredAt` に変更。
  - getter `get occurredAt(): OccurredAt` を返すよう変更（raw Date getter を廃止）。
  - `equals` の発生日時比較を `this._occurredAt.equals(other._occurredAt)` に委譲。
  - テスト: `StepApproval.create(actor, OccurredAt.from(...))` 等へ追従。
- コミットメッセージ: `refactor: イベントVOの発生日時を OccurredAt で表現し raw Date を締め出す`

### Step 3: 呼び出し側（Mapper / ドメインエンティティ）の追従
- 対象ファイル:
  - `src/server/subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper.ts`
  - `src/server/subdomains/estimate/domain/entities/approval/EstimateApplication.ts`
  - 関連テスト（`EstimateApprovalStep.test.ts`, `PrismaEstimateApplicationRepository.test.ts` の `occurredAt` アサーション）
- 作業内容:
  - Mapper: `StepApproval.create(empId, s.approval.createdAt)` → `OccurredAt.from(s.approval.createdAt)` を渡す形へ（3イベント分）。
  - `EstimateApplication`: `new Date()` 渡しを `OccurredAt.now()` に置換（192/206/219行相当）。
  - Repository テストの `occurredAt` を `toBeInstanceOf(Date)` から `OccurredAt` ベースの検証へ追従（必要に応じ `.toDate()` を噛ませる）。
- コミットメッセージ: `refactor: Mapper と EstimateApplication を OccurredAt 経由に追従`

### Step 4: 全テスト・lint 確認
- 対象ファイル: なし（検証のみ）
- 作業内容:
  - `pnpm test` でドメイン/インフラのテストが緑であることを確認。
  - `pnpm lint` で型・lint を確認。
  - 必要なら `docs/claude-plans/issue-404/deviations.md` に計画との差異を記録（CLAUDE.md ルール）。
- コミットメッセージ: （コード変更が無ければコミット不要。差異記録が出たら `docs: issue-404 実装の計画逸脱を記録`）
