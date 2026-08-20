/**
 * 開発用 seed（seed-dev.ts）と単体テスト用 seed（seed-unit.ts）が共有する正準マスタ定数。
 *
 * これらは ADR-0063 の役職4段鎖・消費税率マスタで、ほぼ変化しない固定値。ここでの共有は
 * 「seed の合成」ではなく「定数の共有」であり、DB・seed 実行・シナリオデータは各 seed で
 * 完全に別のまま、値のドリフト（ADR 変更時に片側だけ腐る事故）だけを防ぐ目的で切り出す（Issue #584）。
 *
 * ROLES は共有しない。開発 seed 側では今後シナリオ用に役割を増やす想定があり、共有すると
 * 単体テストが code 引きする正準集合（ROLE001-015）が揺れるため。各 seed が自前で保持する。
 */

/** 役職マスタ（POS001 課長 → POS004 社長 の4段鎖。上位役職は positionCd で解決する）。 */
export const POSITIONS: { cd: string; name: string; superiorCd: string | null }[] = [
  { cd: "POS001", name: "課長", superiorCd: "POS002" },
  { cd: "POS002", name: "部長", superiorCd: "POS003" },
  { cd: "POS003", name: "本部長", superiorCd: "POS004" },
  { cd: "POS004", name: "社長", superiorCd: null },
];

/** 消費税率マスタ（施行日昇順で投入。前期間の終わり = 次行の effectiveFrom の暗黙）。 */
export const TAX_RATES: { rate: string; effectiveFrom: Date }[] = [
  { rate: "0.080", effectiveFrom: new Date("2014-04-01T00:00:00+09:00") },
  { rate: "0.100", effectiveFrom: new Date("2019-10-01T00:00:00+09:00") },
];
