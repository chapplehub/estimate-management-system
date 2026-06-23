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
   * 申請アグリゲートを楽観ロック付きで更新する（承認・差戻・取下／方式 A・ADR-0039/0058）。
   *
   * ステップ骨格は不変なので一切触れず、終端イベント行のみを自然キー（stepId / applicationId =
   * @id）で追記する。並行性は version ガード（WHERE id AND version の条件付き UPDATE →
   * count 0 で競合）が担い、冪等性は `createMany({ skipDuplicates: true })` が担う（既決イベントは
   * @id 衝突でスキップされ created_at を保持する）。テーブル毎に 1 往復へ畳み、version ロック
   * 保持中の往復数を抑える。occurredAt はイベント行の created_at（@default(now())）で確定する
   * ため書き込まず、末尾の refetch で復元する。
   */
  async update(
    application: EstimateApplication,
    expectedVersion: number
  ): Promise<EstimateApplication> {
    const applicationId = application.id.value;

    await prisma.$transaction(async (tx) => {
      // 1. ルートの version を条件付きインクリメント（楽観ロックのチェック地点）。
      //    count 0 は version 不一致（先行更新あり）を意味する。申請は delete を持たない
      //    append-only 集約のため行消失は通常起きない。throw で $transaction 全体をロールバックする。
      const rootUpdate = await tx.estimateApplication.updateMany({
        where: { id: applicationId, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (rootUpdate.count === 0) {
        throw new ConflictError(
          "他のユーザーによって更新されています。画面を再読み込みして最新の内容を確認してください。"
        );
      }

      // 2. 承認・差戻イベントを自然キーで一括追記（既決は skipDuplicates でスキップ = created_at 保持）。
      const approvals = EstimateApplicationMapper.toStepApprovalCreateInputs(application);
      if (approvals.length > 0) {
        await tx.estimateStepApproval.createMany({ data: approvals, skipDuplicates: true });
      }
      const rejections = EstimateApplicationMapper.toStepRejectionCreateInputs(application);
      if (rejections.length > 0) {
        await tx.estimateStepRejection.createMany({ data: rejections, skipDuplicates: true });
      }

      // 3. 取下イベント（申請レベル・高々 1）も同じく自然キーで冪等追記する。
      const withdrawal = EstimateApplicationMapper.toWithdrawalCreateInput(application);
      if (withdrawal) {
        await tx.estimateApplicationWithdrawal.createMany({
          data: [withdrawal],
          skipDuplicates: true,
        });
      }
    });

    return this.refetch(applicationId);
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
   * ステップの `application` リレーションを辿り、親集約を 1 クエリで読む（承認 Inbox の
   * 「このステップを承認」導線は最頻読取のため往復を 1 回に抑える）。
   */
  async findByStepId(stepId: EstimateApprovalStepId): Promise<EstimateApplication | null> {
    const step = await prisma.estimateApprovalStep.findUnique({
      where: { id: stepId.value },
      select: { application: { include: ESTIMATE_APPLICATION_FULL_INCLUDE } },
    });
    return step ? EstimateApplicationMapper.toDomain(step.application) : null;
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

  /**
   * 新規作成系の P2002（一意制約違反）を ConflictError へ翻訳する。
   *
   * 本 insert で発火しうる P2002 は実質 `@@unique([variationId, attempt])` のみ。ネスト create する
   * steps の `@@unique([applicationId, stepOrder])` は新規 applicationId 配下かつ stepOrder が
   * 1 始まり連番のため衝突不能、id は UUIDv7 で衝突不能。よって制約名で絞らず一律翻訳しても
   * メッセージは (variationId, attempt) 競合に対応する（並行採番レース・§6.3 を再試行可能化）。
   */
  private static translateInsertConflict(error: unknown, application: EstimateApplication): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        `バリエーション ${application.variationId.value} の ${application.attempt} 回目の申請は既に存在します。画面を再読み込みしてください。`
      );
    }
    throw error;
  }
}
