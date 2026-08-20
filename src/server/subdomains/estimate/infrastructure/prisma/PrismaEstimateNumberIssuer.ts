import prisma from "@server/prisma";
import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EstimateNumberIssuer } from "@subdomains/estimate/domain/repositories/EstimateNumberIssuer";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";
import { EstimateType as PrismaEstimateType } from "@generated/prisma/enums";

/**
 * EstimateNumberIssuer の Prisma 実装（§2.3 保存時採番）。
 *
 * 採番方式: 年度 × 見積種別で絞った estimates の MAX(sequence) + 1。
 * 専用カウンタテーブルは設けない。理由:
 * - 一意性は estimateNumber @unique が最終的に保証する（連番衝突は保存時 P2002 で検出）。
 * - 見積は物理削除しない運用方針のため MAX(sequence) は単調増加し、欠番は出ても
 *   連番の再利用は起きない（§2.2 を実運用上満たす）。
 * - 同時作成による連番衝突は稀（年間 ~1000 件規模）であり、衝突時は手動リトライで吸収する。
 *
 * 並行作成で同一連番が払い出され得るが、その場合の最終防壁は estimateNumber @unique
 * （PrismaEstimateRepository.save が P2002 を ConflictError に翻訳）であり、本実装は
 * 楽観的に MAX+1 を返す。将来カウンタ実装へ差し替える場合も EstimateNumberIssuer
 * ポート経由のためアプリ層は無変更で済む。
 */
export class PrismaEstimateNumberIssuer implements EstimateNumberIssuer {
  async issueNext(fiscalYear: FiscalYear, estimateType: EstimateType): Promise<EstimateNumber> {
    // 年度 × 種別で絞った中の最大連番を 1 行だけ取得する（該当なしは null）。
    const latest = await prisma.estimate.findFirst({
      where: {
        fiscalYear: fiscalYear.value,
        estimateType: estimateType.value as PrismaEstimateType,
      },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });

    const currentMax = latest?.sequence ?? 0;
    const nextSequence = currentMax + 1;

    if (nextSequence > EstimateNumber.SEQUENCE_MAX) {
      throw new BusinessRuleViolationError(
        `見積番号の連番が上限（${EstimateNumber.SEQUENCE_MAX}）に達しました: ` +
          `年度=${fiscalYear.value} 種別=${estimateType.value}`
      );
    }

    const text =
      estimateType.prefix + fiscalYear.toShortString() + String(nextSequence).padStart(5, "0");

    // 組み立て結果を VO 検証で再確認する（不正フォーマットを永続化層で堰き止める）。
    return EstimateNumber.parse(text);
  }
}
