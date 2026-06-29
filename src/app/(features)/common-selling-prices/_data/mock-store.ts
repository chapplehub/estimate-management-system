/**
 * 共通売単価 保守画面の インメモリ・モックストア（#429 第一段階 / プレゼンテーション層先行）。
 *
 * BE基盤（#466）が未実装のため、プロトタイプ（`docs/design/common-selling-price-maintenance/
 * 共通売単価 保守画面.dc.html` の `seed()`）のシードを流用した読み取り専用ストア。
 * #466 完成時はこのモジュールごと差し替える（`queries.ts` のシグネチャは維持）。
 *
 * 読み取り（`getAllAggregates` / `getAggregateByProductCd`）に加え、ミューテータ
 * （登録・編集・適用終了・削除）を持つ。不変条件（重複禁止・状態別権限・楽観ロック）は
 * ここに集約し、Server Action は parse→ミューテータ→catch→revalidate の薄いガワに保つ
 * （ラウンド2決定1）。違反時は本番リポジトリ／コマンドと同じ既存エラー型を throw して
 * Action の catch を本番同形にする（#466 差し替え時に Action を変えずに済む）。
 */

import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { authorityFor, classifyState, hasOverlap } from "./period-rules";

/**
 * 参照日（時点解決の基準日）。プロトタイプの `TODAY` に一致。
 *
 * #466 で未決の「参照日の注入方法」をFE側でも1箇所に閉じ込める。
 * 将来はクロック注入／引数注入へ差し替え可能にするための単一の集約点。
 */
export const REFERENCE_DATE = "2026-06-27";

/** ストア内部の適用期間行（永続層の1レコード相当）。 */
export type MockPeriod = {
  periodId: string;
  /** 適用開始日 `YYYY-MM-DD`（下端・含む）。 */
  startDate: string;
  /** 適用終了日 `YYYY-MM-DD`（上端・含まない）。null=無期限。 */
  endDate: string | null;
  /** 共通売単価（円・0以上）。 */
  price: number;
};

/** ストア内部の商品単位集約（1商品=1集約）。 */
export type MockAggregate = {
  productCd: string;
  productName: string;
  /** 集約ルートの楽観ロックversion（ADR-0039）。 */
  version: number;
  /** 適用期間行（開始日昇順で保持）。 */
  periods: MockPeriod[];
};

/** シード定義の簡易表現（periodId はロード時に決定論的に採番）。 */
type SeedPeriod = {
  startDate: string;
  endDate: string | null;
  price: number;
};
type SeedProduct = {
  productCd: string;
  productName: string;
  periods: SeedPeriod[];
};

/**
 * プロトタイプのシード（PRD001〜015）。
 * カテゴリは UC-1 の列・原価非表示方針（use-cases.md §6）に不要なため読みモデルへ持ち込まない。
 */
const SEED: SeedProduct[] = [
  {
    productCd: "PRD001",
    productName: "オフィスデスク 平机 W1200",
    periods: [
      { startDate: "2024-04-01", endDate: "2025-04-01", price: 28000 },
      { startDate: "2025-04-01", endDate: null, price: 29800 },
    ],
  },
  {
    productCd: "PRD002",
    productName: "事務用チェア 肘付",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 18500 }],
  },
  {
    productCd: "PRD003",
    productName: "ノートPC 14型",
    periods: [
      { startDate: "2025-01-01", endDate: "2026-07-01", price: 98000 },
      { startDate: "2026-07-01", endDate: null, price: 102000 },
    ],
  },
  {
    productCd: "PRD004",
    productName: "デスクトップPC",
    periods: [{ startDate: "2024-10-01", endDate: null, price: 84000 }],
  },
  {
    productCd: "PRD005",
    productName: "モノクロコピー機",
    periods: [{ startDate: "2023-04-01", endDate: "2025-10-01", price: 240000 }],
  },
  {
    productCd: "PRD006",
    productName: "カラー複合機 A3対応",
    periods: [{ startDate: "2025-06-01", endDate: null, price: 320000 }],
  },
  {
    productCd: "PRD007",
    productName: "A4コピー用紙 500枚",
    periods: [],
  },
  {
    productCd: "PRD008",
    productName: "ホワイトボード 1800×900",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 22000 }],
  },
  {
    productCd: "PRD009",
    productName: "スチール書庫 両開き",
    periods: [],
  },
  {
    productCd: "PRD010",
    productName: "LEDデスクライト",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 4800 }],
  },
  {
    productCd: "PRD011",
    productName: "シュレッダー 業務用",
    periods: [{ startDate: "2022-04-01", endDate: "2024-04-01", price: 35000 }],
  },
  {
    productCd: "PRD012",
    productName: "プロジェクター フルHD",
    periods: [
      { startDate: "2025-03-01", endDate: "2026-09-01", price: 72000 },
      { startDate: "2026-09-01", endDate: null, price: 76000 },
    ],
  },
  {
    productCd: "PRD013",
    productName: "会議用テーブル W1800",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 45000 }],
  },
  {
    productCd: "PRD014",
    productName: "トナーカートリッジ 純正",
    periods: [
      { startDate: "2024-04-01", endDate: "2025-04-01", price: 12000 },
      { startDate: "2025-04-01", endDate: null, price: 12800 },
    ],
  },
  {
    productCd: "PRD015",
    productName: "USBメモリ 64GB",
    periods: [{ startDate: "2025-04-01", endDate: null, price: 1280 }],
  },
];

/** シードを集約配列へロードする。periodId は `{商品コード}-p{連番}` で決定論的に採番。 */
function loadSeed(): MockAggregate[] {
  return SEED.map((product) => ({
    productCd: product.productCd,
    productName: product.productName,
    version: 1,
    periods: product.periods.map((period, index) => ({
      periodId: `${product.productCd}-p${index + 1}`,
      startDate: period.startDate,
      endDate: period.endDate,
      price: period.price,
    })),
  }));
}

/** プロセス内に保持する単一ストア（モック）。次ラウンドのミューテータはこれを書き換える。 */
const store: MockAggregate[] = loadSeed();

/** 全集約を商品コード昇順で返す（読み取り専用コピー）。 */
export function getAllAggregates(): MockAggregate[] {
  return [...store].sort((a, b) => a.productCd.localeCompare(b.productCd));
}

/** 商品コードで集約を1件返す。無ければ null。 */
export function getAggregateByProductCd(productCd: string): MockAggregate | null {
  return store.find((aggregate) => aggregate.productCd === productCd) ?? null;
}

// ───────────────────────── ミューテータ（書き込み） ─────────────────────────

/** 楽観ロック競合の標準文言（本番リポジトリと同一。ADR-0039）。 */
const CONFLICT_MESSAGE =
  "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。";

/** 重複違反の文言。 */
const OVERLAP_MESSAGE = "適用期間が既存の期間と重複しています。";

/**
 * 新規 periodId の単調カウンタ。
 * シードの `{商品コード}-p{連番}`（index採番）は delete→add で既存IDと衝突するため、
 * 別系列（`-new{n}`）で衝突しないよう単調に採番する。
 */
let periodIdCounter = 0;
function nextPeriodId(productCd: string): string {
  periodIdCounter += 1;
  return `${productCd}-new${periodIdCounter}`;
}

/**
 * 書き込み対象の集約を取得し version を突合する。
 * 集約が無い（削除済み相当）か version 不一致なら ConflictError（再読込を促す文言）。
 */
function loadForWrite(productCd: string, expectedVersion: number): MockAggregate {
  const aggregate = store.find((a) => a.productCd === productCd);
  if (aggregate == null || aggregate.version !== expectedVersion) {
    throw new ConflictError(CONFLICT_MESSAGE);
  }
  return aggregate;
}

/** 対象期間行を取得する。無ければ ConflictError（他者削除相当）。 */
function requirePeriod(aggregate: MockAggregate, periodId: string): MockPeriod {
  const period = aggregate.periods.find((p) => p.periodId === periodId);
  if (period == null) throw new ConflictError(CONFLICT_MESSAGE);
  return period;
}

/** UC-3 登録の入力（適用開始日・適用終了日・単価）。 */
export type AddPeriodInput = {
  startDate: string;
  endDate: string | null;
  price: number;
};

/** UC-3 適用期間を登録する。既存期間と重複したら拒否。version を bump。 */
export async function addPeriod(
  productCd: string,
  expectedVersion: number,
  input: AddPeriodInput
): Promise<void> {
  const aggregate = loadForWrite(productCd, expectedVersion);
  if (hasOverlap(input, aggregate.periods)) {
    throw new BusinessRuleViolationError(OVERLAP_MESSAGE);
  }
  aggregate.periods.push({
    periodId: nextPeriodId(productCd),
    startDate: input.startDate,
    endDate: input.endDate,
    price: input.price,
  });
  aggregate.periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
  aggregate.version += 1;
}

/** UC-4 将来行の全項目編集の入力。 */
export type UpdateFuturePeriodInput = {
  periodId: string;
  startDate: string;
  endDate: string | null;
  price: number;
};

/** UC-4 将来開始の期間行を全項目編集する。将来行以外は拒否、重複は自己除外で判定。 */
export async function updateFuturePeriod(
  productCd: string,
  expectedVersion: number,
  input: UpdateFuturePeriodInput
): Promise<void> {
  const aggregate = loadForWrite(productCd, expectedVersion);
  const target = requirePeriod(aggregate, input.periodId);
  if (!authorityFor(classifyState(target, REFERENCE_DATE)).editable) {
    throw new BusinessRuleViolationError("将来開始の期間のみ編集できます。");
  }
  if (hasOverlap(input, aggregate.periods, input.periodId)) {
    throw new BusinessRuleViolationError(OVERLAP_MESSAGE);
  }
  target.startDate = input.startDate;
  target.endDate = input.endDate;
  target.price = input.price;
  aggregate.periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
  aggregate.version += 1;
}

/** UC-4 適用終了（end-dating）の入力。終了日のみ（無期限化ではなく終了させる操作ゆえ必須）。 */
export type EndDateCurrentPeriodInput = {
  periodId: string;
  endDate: string;
};

/** UC-4 現在有効行に終了日を設定し以後の時点解決から外す（適用終了）。現在有効行以外は拒否。 */
export async function endDateCurrentPeriod(
  productCd: string,
  expectedVersion: number,
  input: EndDateCurrentPeriodInput
): Promise<void> {
  const aggregate = loadForWrite(productCd, expectedVersion);
  const target = requirePeriod(aggregate, input.periodId);
  if (!authorityFor(classifyState(target, REFERENCE_DATE)).endDatable) {
    throw new BusinessRuleViolationError("現在有効な期間のみ適用終了できます。");
  }
  // 適用終了は「以後適用しなくする」操作。過去で締めて現在の有効性を遡及的に消さないよう
  // 終了日は本日以降（use-cases.md §4「今日以降で適用終了」）。終了>開始は zod 層で担保。
  if (input.endDate < REFERENCE_DATE) {
    throw new BusinessRuleViolationError("適用終了日は本日以降を指定してください。");
  }
  // 終了日を延ばして後続の将来期間に食い込むケースを最終チェック（自己除外）。
  const candidate = { startDate: target.startDate, endDate: input.endDate };
  if (hasOverlap(candidate, aggregate.periods, input.periodId)) {
    throw new BusinessRuleViolationError(OVERLAP_MESSAGE);
  }
  target.endDate = input.endDate;
  aggregate.version += 1;
}

/** UC-5 削除の入力。 */
export type DeletePeriodInput = {
  periodId: string;
};

/** UC-5 未適用（将来開始）の期間行を物理削除する。将来行以外は拒否。最低1期間ガードは持たない。 */
export async function deletePeriod(
  productCd: string,
  expectedVersion: number,
  input: DeletePeriodInput
): Promise<void> {
  const aggregate = loadForWrite(productCd, expectedVersion);
  const target = requirePeriod(aggregate, input.periodId);
  if (!authorityFor(classifyState(target, REFERENCE_DATE)).deletable) {
    throw new BusinessRuleViolationError("将来開始の期間のみ削除できます。");
  }
  aggregate.periods = aggregate.periods.filter((p) => p.periodId !== input.periodId);
  aggregate.version += 1;
}
