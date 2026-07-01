import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApplicationId } from "@subdomains/estimate/domain/values/approval/EstimateApplicationId";

/**
 * 申請取下コマンドの入力（§7.3）。
 *
 * 取下の対象特定は申請ルート ID で行う（承認/差戻が stepId 起点なのと異なり、取下は
 * 申請単位の操作のため）。`expectedVersion` は画面表示時に取得した楽観ロックトークン
 * （ADR-0039）で、最終承認との競合を直列化する。
 */
export type WithdrawApplicationInput = {
  applicationId: string;
  /** 取下操作者。本人性は集約内で完結するためドメイン withdraw がガードする。 */
  operatorEmployeeId: string;
  expectedVersion: number;
};

/**
 * 申請取下ユースケース（§7.3）。
 *
 * 流れ: 申請ルートをロード → ドメイン withdraw（本人性・PENDING をガード）→ version 付きで保存。
 * 権限（申請者本人のみ）判定材料 applicantEmployeeId は集約内に完結するため、認可はドメインに
 * 委ね、コマンドは operator を渡すのみとする（承認/差戻が集約外の役割グラフを要しアプリ層で
 * 認可するのと対称）。単一集約の更新1回で完結し原子性は repo.update 内の runAtomically が担保
 * するため TransactionRunner は注入しない（ActivateVariationCommand と同型）。
 *
 * stale な expectedVersion では infra が ConflictError（ADR-0039）を投げ、本コマンドは握り潰さず
 * 伝播して再読み込み→再判断に委ねる。
 */
export class WithdrawApplicationCommand {
  constructor(private readonly applicationRepository: EstimateApplicationRepository) {}

  async execute(input: WithdrawApplicationInput): Promise<EstimateApplication> {
    const application = await this.applicationRepository.findById(
      new EstimateApplicationId(input.applicationId)
    );
    if (!application) {
      throw new NotFoundEntityError(EstimateApplication, { id: input.applicationId });
    }

    application.withdraw(new EmployeeId(input.operatorEmployeeId));

    return this.applicationRepository.update(application, input.expectedVersion);
  }
}
