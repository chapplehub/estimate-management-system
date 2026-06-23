import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { EstimateApplicationRepository } from "@subdomains/estimate/domain/repositories/approval/EstimateApplicationRepository";
import { EstimateApplicationId } from "@subdomains/estimate/domain/values/approval/EstimateApplicationId";
import { EstimateApprovalStepId } from "@subdomains/estimate/domain/values/approval/EstimateApprovalStepId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import {
  ESTIMATE_APPLICATION_FULL_INCLUDE,
  EstimateApplicationMapper,
} from "@subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper";
import { Prisma } from "@generated/prisma/client";

/**
 * PrismaEstimateApplicationRepository
 *
 * 見積申請集約（EstimateApplication → EstimateApprovalStep ＋ 終端イベント）の永続化を担う
 * EstimateApplicationRepository の Prisma 実装（ADR-0039/0058）。集約ルート単位でのみ永続化し、
 * ステップ骨格・終端イベントは集約経由で書く。状態は保存せず行の存在から導出する。
 */
export class PrismaEstimateApplicationRepository implements EstimateApplicationRepository {
  /**
   * 申請を新規作成する（ルート＋ステップ骨格をネスト create で同一トランザクション保存）。
   * 生成時点でイベントは無い。(variationId, attempt) の unique 衝突（並行採番レース・§6.3）は
   * P2002 を ConflictError へ翻訳して再試行可能な競合として表面化する。
   */
  async insert(application: EstimateApplication): Promise<EstimateApplication> {
    try {
      await prisma.estimateApplication.create({
        data: EstimateApplicationMapper.toCreateInput(application),
      });
    } catch (error) {
      PrismaEstimateApplicationRepository.translateInsertConflict(error, application);
    }

    return this.refetch(application.id.value);
  }

  /**
   * 申請アグリゲートを楽観ロック付きで更新する（承認・差戻・取下）。
   * 本実装は Step 3 で追加する（現時点では未実装）。
   */
  async update(
    _application: EstimateApplication,
    _expectedVersion: number
  ): Promise<EstimateApplication> {
    throw new Error("PrismaEstimateApplicationRepository.update は未実装です（Step 3 で実装）");
  }

  async findById(id: EstimateApplicationId): Promise<EstimateApplication | null> {
    const row = await prisma.estimateApplication.findUnique({
      where: { id: id.value },
      include: ESTIMATE_APPLICATION_FULL_INCLUDE,
    });

    return row ? EstimateApplicationMapper.toDomain(row) : null;
  }

  /**
   * 承認ステップ ID から、それを含む申請ルートを取得する（§7.1/§7.2）。
   * まずステップ行から所属 applicationId を引き、申請ルートをアグリゲート単位で読み直す。
   */
  async findByStepId(stepId: EstimateApprovalStepId): Promise<EstimateApplication | null> {
    const step = await prisma.estimateApprovalStep.findUnique({
      where: { id: stepId.value },
      select: { applicationId: true },
    });
    if (!step) {
      return null;
    }
    return this.findById(new EstimateApplicationId(step.applicationId));
  }

  /**
   * バリエーション ID から申請を取得する（attempt 通番の履歴・§3.2/§6.3）。
   * 差戻→再申請で複数 attempt を持ちうるため全件を attempt 昇順で返す。
   */
  async findByVariationId(variationId: EstimateVariationId): Promise<EstimateApplication[]> {
    const rows = await prisma.estimateApplication.findMany({
      where: { variationId: variationId.value },
      include: ESTIMATE_APPLICATION_FULL_INCLUDE,
      orderBy: { attempt: "asc" },
    });

    return rows.map((row) => EstimateApplicationMapper.toDomain(row));
  }

  /** 保存後の集約を完全な include で読み直して返す（イベント createdAt を DB 既定で確定させる）。 */
  private async refetch(id: string): Promise<EstimateApplication> {
    const row = await prisma.estimateApplication.findUnique({
      where: { id },
      include: ESTIMATE_APPLICATION_FULL_INCLUDE,
    });
    if (!row) {
      throw new Error(`保存した見積申請の再取得に失敗しました: ${id}`);
    }
    return EstimateApplicationMapper.toDomain(row);
  }

  private static translateInsertConflict(error: unknown, application: EstimateApplication): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        `バリエーション ${application.variationId.value} の ${application.attempt} 回目の申請は既に存在します。画面を再読み込みしてください。`
      );
    }
    throw error;
  }
}
