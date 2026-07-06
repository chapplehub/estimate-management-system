/**
 * 承認系テスト見積番号帯レジストリ（単一ソース・#493）。
 *
 * 承認系(N9907xxx)の実DB統合テストは、共有テストDB上で各テストファイルが「10番号 = 1サブ帯(0x)」を
 * 占有することで相互隔離する（ADR-0012 によりテスト内で Prisma を直接使わず、見積番号帯で論理分割）。
 * この定数がその帯割り当ての**唯一の真実**であり、各テストは自分の帯をここから引く（番号のハードコードを
 * 各ファイルに散らさない）。番号のグローバル一意性は `approvalTestBands.test.ts` のガードが機械検証する。
 *
 * ## サブ帯割り当て表
 * | サブ帯 | 所有ファイル | 番号 |
 * |---|---|---|
 * | 00x | PrismaEstimateApprovalExemptionRepository.test.ts | N9907001-003 |
 * | 01x | PrismaEstimateApplicationRepository.test.ts       | N9907010-018 |
 * | 02x | WithdrawApplicationCommand.test.ts                | N9907020-022 |
 * | 03x | ApproveStepCommand.test.ts                        | N9907030-032 |
 * | 04x | RejectStepCommand.test.ts                         | N9907040-043 |
 * | 05x | GetVariationApplicationStatesQuery.test.ts        | N9907050-058 |
 *
 * ## 帯を追加する手順
 * 次の空き 0x 帯（現状 06x 以降）に新しい所有者キーを追加し、値の見積番号を採番する。
 * 既存帯の番号は変更しない。追加後にガードテストが一意性を検証する。
 */
export const APPROVAL_TEST_BANDS = {
  // 00x: 承認免除リポジトリ
  exemptionRepository: {
    roundtrip: "N9907001",
    conflict: "N9907002",
    txRollback: "N9907003",
  },
  // 01x: 見積申請リポジトリ
  applicationRepository: {
    roundtrip: "N9907010",
    byStep: "N9907011",
    history: "N9907012",
    conflict: "N9907013",
    approve: "N9907014",
    reject: "N9907015",
    withdraw: "N9907016",
    stale: "N9907017",
    txRollback: "N9907018",
  },
  // 02x: 申請取下コマンド
  withdrawCommand: {
    withdraw: "N9907020",
    notApplicant: "N9907021",
    stale: "N9907022",
  },
  // 03x: ステップ承認コマンド
  approveStepCommand: {
    approve: "N9907030",
    notMember: "N9907031",
    stale: "N9907032",
  },
  // 04x: ステップ差戻コマンド
  rejectStepCommand: {
    reject: "N9907040",
    notMember: "N9907041",
    emptyComment: "N9907042",
    stale: "N9907043",
  },
  // 05x: バリエーション別 申請状態参照クエリ
  variationQuery: {
    none: "N9907050",
    pending: "N9907051",
    rejected: "N9907052",
    withdrawn: "N9907053",
    approved: "N9907054",
    exempted: "N9907055",
    siblings: "N9907056",
    inactive: "N9907057",
    missing: "N9907058",
  },
} as const;
