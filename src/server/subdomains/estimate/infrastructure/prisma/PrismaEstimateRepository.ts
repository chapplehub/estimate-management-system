import { ConflictError } from "@server/shared/errors/ApplicationError";
import { currentClient, runAtomically } from "@server/shared/infrastructure/transaction/txContext";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateVariationCopy } from "@subdomains/estimate/domain/values/EstimateVariationCopy";
import {
  ESTIMATE_FULL_INCLUDE,
  EstimateMapper,
} from "@subdomains/estimate/infrastructure/mappers/EstimateMapper";
import { Prisma } from "@generated/prisma/client";

/**
 * PrismaEstimateRepository
 *
 * 見積集約（Estimate → EstimateVariation → EstimateItem ＋ 修理系子エンティティ）の
 * 永続化を担う EstimateRepository の Prisma 実装。
 * 集約ルート Estimate 単位でのみ永続化し、子は集約経由でカスケードする。
 *
 * DB アクセスは素の `prisma` ではなく `currentClient()` 経由で行う（ADR-20260626-dee）。これにより
 * TransactionRunner（申請 submit の atomic submit 等）が張った ambient トランザクションに
 * 相乗りし、無ければ global prisma で従来どおり動く。多文メソッドは `runAtomically`（join-or-open）
 * で囲み、単独呼び出しでも原子性を保つ。
 */
export class PrismaEstimateRepository implements EstimateRepository {
  /**
   * 見積を新規作成する。セット群の所属交差表（estimate_set_components）は、ネスト create では
   * 兄弟の estimate_items 行を参照できないため、estimate.create の後に同一トランザクションで
   * createMany する（ADR-0047 / insertWithCopies と同型の順序制約）。
   */
  async insert(estimate: Estimate): Promise<Estimate> {
    try {
      await runAtomically(async () => {
        const db = currentClient();
        await db.estimate.create({
          data: EstimateMapper.toEstimateCreateInput(estimate),
        });
        const components = EstimateMapper.toSetComponentCreateManyInput(estimate);
        if (components.length > 0) {
          await db.estimateSetComponent.createMany({ data: components });
        }
      });
    } catch (error) {
      PrismaEstimateRepository.translateInsertConflict(error, estimate);
    }

    return this.refetch(estimate.id.value);
  }

  /**
   * 見積を新規作成し、複製系譜（estimate_variation_copies）を同一トランザクションで保存する（C6 / ADR-0040）。
   *
   * estimate.create のネスト書き込みでバリエーション行を先に生成し、その後 copies を createMany する
   * （copiedVariationId の FK を満たすための順序）。系譜の copiedVariationId はすべて本 estimate 配下の
   * バリエーションを指し、複製元へは id 参照のみ（書き込みなし）。
   */
  async insertWithCopies(estimate: Estimate, copies: EstimateVariationCopy[]): Promise<Estimate> {
    try {
      await runAtomically(async () => {
        const db = currentClient();
        await db.estimate.create({
          data: EstimateMapper.toEstimateCreateInput(estimate),
        });
        const components = EstimateMapper.toSetComponentCreateManyInput(estimate);
        if (components.length > 0) {
          await db.estimateSetComponent.createMany({ data: components });
        }
        if (copies.length > 0) {
          await db.estimateVariationCopy.createMany({
            data: EstimateMapper.toVariationCopyCreateManyInput(copies),
          });
        }
      });
    } catch (error) {
      PrismaEstimateRepository.translateInsertConflict(error, estimate);
    }

    return this.refetch(estimate.id.value);
  }

  /**
   * 新規作成系の例外を翻訳する（insert / insertWithCopies 共通）。
   * 並行作成で見積番号（estimate_number @unique）が衝突した場合は、インフラ詳細の P2002 を
   * アプリ層の ConflictError へ翻訳して表面化する。採番は楽観的 MAX+1
   * （PrismaEstimateNumberIssuer）であり、衝突は手動リトライで吸収する。
   */
  private static translateInsertConflict(error: unknown, estimate: Estimate): never {
    if (PrismaEstimateRepository.isEstimateNumberConflict(error)) {
      throw new ConflictError(
        `見積番号 ${estimate.estimateNumber.value} は既に使用されています。もう一度登録してください。`
      );
    }
    throw error;
  }

  /**
   * 既存集約の更新。子の行 identity（id・createdAt）を保持する差分 upsert。
   * 全削除→再作成にしないのは、EstimateVariation を参照する Order / Copy / Revision を
   * カスケード破壊しないため。
   *
   * 楽観ロック（ADR-0039）: ルート更新を WHERE id AND version の条件付き UPDATE で行い、
   * 成功時に version を +1 する。expectedVersion はフォーム往復で持ち回ったトークン。
   */
  async update(estimate: Estimate, expectedVersion: number): Promise<Estimate> {
    const estimateId = estimate.id.value;
    const variationIds = estimate.variations.map((v) => v.id.value);

    try {
      await runAtomically(async () => {
        const db = currentClient();
        // 1. ルートの scalar フィールドを条件付き更新（楽観ロックのチェック地点）。
        //    count 0 は「version 不一致（先行更新あり）」と「行の消失（削除済み）」の両方を
        //    含むが、UPDATE 文からは区別できないため両方を覆うメッセージで競合として扱う。
        //    throw により トランザクション全体（子の差分 upsert 含む）がロールバックされる。
        const rootUpdate = await db.estimate.updateMany({
          where: { id: estimateId, version: expectedVersion },
          data: {
            ...EstimateMapper.toEstimateScalarData(estimate),
            version: { increment: 1 },
          },
        });
        if (rootUpdate.count === 0) {
          throw new ConflictError(
            "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
          );
        }

        // 2. 集約から消えたバリエーションを削除（items → revisedDetail へカスケード）
        await db.estimateVariation.deleteMany({
          where: { estimateId, id: { notIn: variationIds } },
        });

        // 3. 各バリエーションを id キーで upsert し、配下の明細を差分反映。
        //    既存 variation の variationNumber は集約ルートの公開 API では変更されない
        //    （changeVariationNumber が存在しない）ため、survivor の番号は不変。
        //    よって `@@unique([estimateId, variationNumber])` への即時衝突は発生しない。
        //    （番号入れ替えを可能にする API を将来追加する場合は deviations.md 参照）
        for (const variation of estimate.variations) {
          const variationId = variation.id.value;
          const variationScalar = EstimateMapper.toVariationScalarData(variation);
          await db.estimateVariation.upsert({
            where: { id: variationId },
            create: { id: variationId, estimateId, ...variationScalar },
            update: variationScalar,
          });

          // 改訂系譜（高々1・ADR-0044）の同期。出自 revisedFrom は不変かつ改訂で生まれた
          // バリエーションは常に新規行のため create のみで足りるが、再保存の冪等性のため
          // 自然キー（revisedVariationId @unique）で upsert する（update は no-op）。
          // 改訂先バリエーションの削除時は onDelete: Cascade で系譜行も消える
          if (variation.revisedFrom) {
            await db.estimateVariationRevision.upsert({
              where: { revisedVariationId: variationId },
              create: EstimateMapper.toVariationRevisionCreateInput(variation),
              update: {},
            });
          }

          const itemIds = variation.items.map((i) => i.id.value);
          await db.estimateItem.deleteMany({
            where: { variationId, id: { notIn: itemIds } },
          });

          for (const item of variation.items) {
            const itemId = item.id.value;
            const itemScalar = EstimateMapper.toItemScalarData(item);
            await db.estimateItem.upsert({
              where: { id: itemId },
              create: { id: itemId, variationId, ...itemScalar },
              update: itemScalar,
            });

            // 改訂明細詳細（1:1）の同期
            if (item.revisedDetail) {
              const revisedScalar = EstimateMapper.toRevisedDetailScalarData(item.revisedDetail);
              await db.revisedEstimateItemDetail.upsert({
                where: { estimateItemId: itemId },
                create: {
                  id: item.revisedDetail.id.value,
                  estimateItemId: itemId,
                  ...revisedScalar,
                },
                update: revisedScalar,
              });
            } else {
              await db.revisedEstimateItemDetail.deleteMany({
                where: { estimateItemId: itemId },
              });
            }
          }

          // 3.5 セット群の差分同期（ADR-0047）。順序: 群（identity 保持 upsert）→ 交差表
          //     （全削除→再作成）。明細 upsert の後に行うため、構成明細 FK は満たされる。
          const setGroupIds = variation.setGroups.map((g) => g.id.value);
          // 集約から消えた群を削除（配下の交差行は onDelete: Cascade で連鎖削除）
          await db.estimateSetGroup.deleteMany({
            where: { variationId, id: { notIn: setGroupIds } },
          });
          // 生存・新規の群を id キーで upsert（群ヘッダのみ。被参照のため identity を保持）
          for (const group of variation.setGroups) {
            const groupScalar = EstimateMapper.toSetGroupScalarData(group);
            await db.estimateSetGroup.upsert({
              where: { id: group.id.value },
              create: { id: group.id.value, variationId, ...groupScalar },
              update: groupScalar,
            });
          }
          // 交差表は identity を持たない（surrogate id・被参照なし）。生存群の所属を全削除して
          // 作り直す。削除済み明細・群の交差行は上のカスケードで既に消えているため、当該
          // バリエーションの交差行はここでゼロになり、createMany で PK 衝突は起きない。
          if (setGroupIds.length > 0) {
            await db.estimateSetComponent.deleteMany({
              where: { setGroupId: { in: setGroupIds } },
            });
          }
          const components = variation.setGroups.flatMap((g) =>
            g.memberItemIds.map((memberId) => ({
              itemId: memberId.value,
              setGroupId: g.id.value,
            }))
          );
          if (components.length > 0) {
            await db.estimateSetComponent.createMany({ data: components });
          }
        }

        // 4. 修理系サブタイプ（排他・1:1）の同期。存在する片方を upsert、他方を削除。
        if (estimate.repairDetail) {
          const repairScalar = EstimateMapper.toRepairDetailScalarData(estimate.repairDetail);
          await db.repairEstimateDetail.upsert({
            where: { estimateId },
            create: { id: estimate.repairDetail.id.value, estimateId, ...repairScalar },
            update: repairScalar,
          });
        } else {
          await db.repairEstimateDetail.deleteMany({ where: { estimateId } });
        }

        if (estimate.afterRepairDetail) {
          const afterScalar = EstimateMapper.toAfterRepairDetailScalarData(
            estimate.afterRepairDetail
          );
          await db.afterRepairEstimateDetail.upsert({
            where: { estimateId },
            create: { id: estimate.afterRepairDetail.id.value, estimateId, ...afterScalar },
            update: afterScalar,
          });
        } else {
          await db.afterRepairEstimateDetail.deleteMany({ where: { estimateId } });
        }
      });
    } catch (error) {
      // 他テーブル（Order / Copy / Revision）から参照中のバリエーション削除は FK 違反になる
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new Error(
          "他テーブルから参照されているバリエーションは削除できません（受注・複製・改訂の参照を確認してください）"
        );
      }
      throw error;
    }

    return this.refetch(estimateId);
  }

  /** 保存後の集約を完全な include で読み直して返す（insert / update の戻り値共通化） */
  private async refetch(estimateId: string): Promise<Estimate> {
    const row = await currentClient().estimate.findUnique({
      where: { id: estimateId },
      include: ESTIMATE_FULL_INCLUDE,
    });
    if (!row) {
      throw new Error(`保存した見積の再取得に失敗しました: ${estimateId}`);
    }
    return EstimateMapper.toDomain(row);
  }

  async delete(id: EstimateId): Promise<void> {
    const existing = await currentClient().estimate.findUnique({
      where: { id: id.value },
      select: { id: true },
    });

    if (!existing) {
      return;
    }

    // 子エンティティ（variations → items → revisedDetail / repair・afterRepair）は
    // schema の onDelete: Cascade で連鎖削除される。
    // 改訂系譜（ADR-0044）は両端とも本見積内のバリエーションを指すが、sourceVariation 側
    // FK が Restrict のためカスケードの削除順序によっては違反になる。先に明示削除する
    await runAtomically(async () => {
      const db = currentClient();
      await db.estimateVariationRevision.deleteMany({
        where: { sourceVariation: { estimateId: id.value } },
      });
      await db.estimate.delete({ where: { id: id.value } });
    });
  }

  async findById(id: EstimateId): Promise<Estimate | null> {
    const row = await currentClient().estimate.findUnique({
      where: { id: id.value },
      include: ESTIMATE_FULL_INCLUDE,
    });

    return row ? EstimateMapper.toDomain(row) : null;
  }

  async findByEstimateNumber(estimateNumber: EstimateNumber): Promise<Estimate | null> {
    const row = await currentClient().estimate.findUnique({
      where: { estimateNumber: estimateNumber.value },
      include: ESTIMATE_FULL_INCLUDE,
    });

    return row ? EstimateMapper.toDomain(row) : null;
  }

  /**
   * 一意制約違反（P2002）が見積番号（estimate_number @unique）に対するものか判定する。
   *
   * P2002 の制約対象の伝わり方は Prisma の構成で異なる:
   * - 旧来: `meta.target`（フィールド名配列または制約名文字列）。
   * - Prisma 7 + ドライバアダプタ: `meta.target` は未設定で、
   *   `meta.driverAdapterError.cause.constraint.fields` とエラーメッセージ側に入る。
   * いずれの経路でも拾えるよう、関連情報を文字列化して列名/フィールド名の部分一致で判定する。
   */
  private static isEstimateNumberConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      return false;
    }
    const target = error.meta?.target;
    const haystack = [
      Array.isArray(target) ? target.join(",") : String(target ?? ""),
      JSON.stringify(error.meta?.driverAdapterError ?? ""),
      error.message,
    ].join(" ");
    return haystack.includes("estimate_number") || haystack.includes("estimateNumber");
  }
}
