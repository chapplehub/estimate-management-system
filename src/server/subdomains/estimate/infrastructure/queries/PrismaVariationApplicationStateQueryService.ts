import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import { VariationApplicationStateQueryService } from "@subdomains/estimate/application/queries/VariationApplicationStateQueryService";
import { VariationApplicationStateDTO } from "@subdomains/estimate/application/queries/dto/VariationApplicationStateDTO";
import { deriveApplicationStatus } from "@subdomains/estimate/domain/values/approval/deriveApplicationStatus";
import { VariationApplicationState } from "@subdomains/estimate/domain/values/approval/VariationApplicationState";
import { AdvancingVariationPolicy } from "@subdomains/estimate/domain/policies/approval/AdvancingVariationPolicy";

/**
 * 申請状態導出に必要な read include 定義。バリエーションごとに、免除の有無（存在判定のみ）と、
 * 各申請の §3.6 導出入力（取下行・各ステップの承認/差戻行の存在）を最小限で引く。
 * 状態は保存しないため（ADR-0058）、終端イベント行の存在有無だけを select する。
 */
const VARIATION_APPLICATION_STATE_SELECT = {
  id: true,
  status: true,
  variationNumber: true,
  // 免除は存在判定のみ（1バリエーション高々1件・ADR-0054）。
  exemption: { select: { id: true } },
  applications: {
    select: {
      attempt: true,
      // 取下イベント（申請レベル・高々1）の存在。
      withdrawal: { select: { applicationId: true } },
      // 各ステップの承認/差戻行の存在（§3.6 導出入力）。
      steps: {
        select: {
          approval: { select: { stepId: true } },
          rejection: { select: { stepId: true } },
        },
      },
    },
  },
} satisfies Prisma.EstimateVariationSelect;

type VariationStateRow = Prisma.EstimateVariationGetPayload<{
  select: typeof VARIATION_APPLICATION_STATE_SELECT;
}>;
type ApplicationStateRow = VariationStateRow["applications"][number];

/**
 * VariationApplicationStateQueryService の Prisma 実装（CQRS read model・#493）。
 *
 * 集約（Estimate / EstimateApplication）を再構築せず Prisma を直読みし、免除有無・各申請の
 * §3.6 導出入力を materialize する。そこから先の判定は**書き込みと同一のドメイン共有関数**に委ねる:
 * - 各申請の状態は {@link deriveApplicationStatus}（§3.6 の優先順位）で導出、
 * - バリエーション単位の状態は {@link VariationApplicationState.reduce}（免除最優先→最新attempt→未申請）へ還元、
 * - `canApply` の見積単位ゲートは {@link AdvancingVariationPolicy}（1見積1前進）を共有。
 *
 * 事実の materialize は集約 getter と厳密に一致させる（承認/差戻/取下は行の存在＝ null 判定）。
 */
export class PrismaVariationApplicationStateQueryService implements VariationApplicationStateQueryService {
  async findByEstimateId(estimateId: string): Promise<VariationApplicationStateDTO[]> {
    const variations = await prisma.estimateVariation.findMany({
      where: { estimateId },
      orderBy: { variationNumber: "asc" },
      select: VARIATION_APPLICATION_STATE_SELECT,
    });

    // 各バリを申請状態へ還元し、バリと state をペアで保持する（位置インデックス結合を避ける）。
    const pairs = variations.map((variation) => ({
      variation,
      state: PrismaVariationApplicationStateQueryService.reduceVariationState(variation),
    }));

    // 見積単位の前進ゲート（1見積1前進）。前進バリが1つでもあれば全 ACTIVE バリが申請不可。
    const hasAdvancing = AdvancingVariationPolicy.hasAdvancingVariation(
      pairs.map((pair) => pair.state)
    );

    return pairs.map(({ variation, state }) => ({
      variationId: variation.id,
      applicationState: {
        code: state.code,
        label: state.label,
      },
      canApply: variation.status === "ACTIVE" && !hasAdvancing,
    }));
  }

  /** バリエーション1行を申請状態へ還元する（免除有無＋各申請の §3.6 導出状態を畳み込む）。 */
  private static reduceVariationState(variation: VariationStateRow): VariationApplicationState {
    return VariationApplicationState.reduce({
      isExempted: variation.exemption !== null,
      applications: variation.applications.map((application) => ({
        attempt: application.attempt,
        status: PrismaVariationApplicationStateQueryService.deriveStatus(application),
      })),
    });
  }

  /** 申請1件の §3.6 導出状態を、終端イベント行の存在から materialize して算出する（集約 getter と一致）。 */
  private static deriveStatus(application: ApplicationStateRow) {
    return deriveApplicationStatus({
      hasWithdrawal: application.withdrawal !== null,
      hasAnyRejection: application.steps.some((step) => step.rejection !== null),
      allStepsApproved: application.steps.every((step) => step.approval !== null),
    });
  }
}
