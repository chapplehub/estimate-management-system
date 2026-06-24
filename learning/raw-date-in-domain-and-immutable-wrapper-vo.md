# ドメイン層に raw Date を保持する危険性と不変ラッパーVOによる構造的解決

作成日: 2026-06-24

## 概要

「不変イベントVO」を名乗っていても、内部に JS の `Date`（可変オブジェクト）を raw のまま
抱えると不変性は型で守られない。`readonly` を付けても破れる。Issue #404（estimate サブドメイン
の `StepApproval` / `StepRejection` / `ApplicationWithdrawal`、および `Estimate` 集約の
`estimateDate` 等）で顕在化した。解決方針として「不変ラッパーVO で raw `Date` をドメインから
締め出す」を採用した。

## 詳細

### `readonly` が守るのは「束縛」であって「中身」ではない

```typescript
private readonly _occurredAt: Date;

this._occurredAt = new Date();   // ❌ コンパイルエラー（再代入＝束縛の張り替えを止める）
this._occurredAt.setHours(0);    // ✅ 通る（同じ Date オブジェクトの内部状態を変異させる）
```

- **binding immutability（束縛の不変）**: `readonly` / `const` が保証。別オブジェクトへの張り替えを禁止。
- **object immutability（オブジェクトの不変）**: `readonly` は保証しない。`Date` は `setHours`/`setTime`/
  `setDate` 等の mutator を持つ可変オブジェクトなので、この経路が空く。
- `const x = []` でも `x.push(1)` できるのと同じ構図。ADR-0027 の「`Readonly<T>` はメソッド呼び出しを
  止めない」（子エンティティの `changeQuantity()`）と原理は同一。対象が `Date.setHours()` に変わっただけ。

### 本当の危険は「raw Date インスタンスが VO の外と共有される」こと

自傷（VO 内部から自分の Date を変異）は普通書かない。問題は外との共有で、経路は2つ。

**経路1: 入口での共有（インバウンド）**
```typescript
const t = new Date(...);
const approval = StepApproval.create(empId, t);  // 受け取った参照をそのまま内部保持
t.setHours(0);                                    // 呼び出し側が手元の t を変異させると
approval.occurredAt.getTime();                    // VO 内部も一緒に変わる（同一インスタンス）
```

**経路2: 出口での共有（アウトバウンド）**
```typescript
const leaked = approval.occurredAt;  // getter が内部参照を素通しで返す
leaked.setHours(0);                  // 受け取った側が変異させると
approval.occurredAt.getTime();       // VO 内部が変わる
```

どちらの経路でも `equals`（`getTime()` 比較）の結果が**生成後に変わりうる**。
「行の存在＝承認済を写し取った不変イベント」（ADR-0058）という設計意図が型で守られていない。
`readonly` はどちらの経路も塞げない（どちらも再代入ではなく、共有された同一オブジェクトへの変異だから）。

### 塞ぐ2方針と採用

- **(a) 防御コピー**: 境界ごとに `new Date(d.getTime())` を撒く対症療法。境界が増えるたび保守コストが残る。
  ADR-0027 が子エンティティについて一度「生産性を犠牲にする」として退けた方向。
- **(b) 不変ラッパーVO（採用）**: `Date` をドメイン概念の VO に変換し、入口で raw `Date` を締め出す。
  mutator を露出しない設計にすれば、入口で VO 化された時点で以後の変異経路が構造的に消える。
  `equals` も VO 同士の比較に収束する。この repo は `FiscalYear`（ADR-0024, shared VO 化）、
  `Numbering`（ADR-0026, parse-only 露出）、`Money`（ADR-0022）と「基本型をドメイン概念でラップして
  不変性を型で守る」文化が既に確立しており、(b) が repo の grain に合う。

### 一般教訓

- これは primitive obsession（基本型への執着）の一種。可変な基本型（`Date`, 配列, `Map`）を
  ドメインに raw で持つと「不変VO」は名ばかりになる。
- 不変性は「再代入禁止」だけでなく「可変オブジェクトを境界で外に漏らさない/中に入れない」まで
  含めて初めて型で守れる。

## 参考

- Issue #404（refactor: 見積申請ドメインの不変イベントVO・集約で Date を防御コピーするか統一方針を決める）
- `src/server/subdomains/estimate/domain/values/approval/StepApproval.ts` / `StepRejection.ts` / `ApplicationWithdrawal.ts`
- `src/server/subdomains/estimate/domain/entities/Estimate.ts`（`estimateDate` / `deadline` / `createdAt` / `updatedAt`）
- ADR-0027（集約境界をバレル + ESLint で構造的に強制する：`Readonly<T>` はメソッドを止めない／防御コピーを選択肢Bとして不採用）
- ADR-0024（FiscalYear を shared VO へ）、ADR-0025（JST 固定純関数）、ADR-0026（Numbering parse-only 露出）、ADR-0058（イベント行の存在から状態導出）
