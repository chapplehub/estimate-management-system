import { NotFoundError } from "@server/shared/errors/ApplicationError";
import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { PositionQueryService } from "@subdomains/position/application/queries/PositionQueryService";
import { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleDTO } from "@subdomains/role/application/queries/dto/RoleDTO";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import {
  type AssembleApprovalChainInput,
  type AssembleApprovalChainRole,
} from "./assembleApprovalChain";
import { type PositionHierarchyNode } from "./resolveApprovalGoalTiersByDepth";

/** ローダーが束ねる越境読取りの依存（ADR-0052: アプリ層が事実を集める）。 */
export type ApprovalChainInputLoaderDeps = {
  estimateRepository: EstimateRepository;
  productQueryService: ProductQueryService;
  employeeQueryService: EmployeeQueryService;
  positionQueryService: PositionQueryService;
  roleQueryService: RoleQueryService;
};

/** ローダーの戻り。集約ルートは version 関門（Submit）に、入力はアセンブラに渡す。 */
export type LoadedApprovalChainInputs = {
  /** version 関門（`EstimateRepository.update`）に使う集約ルート。 */
  estimate: Estimate;
  /** 対象バリエーションが有効（ACTIVE）か。INACTIVE 拒否の判断は呼び出し側が担う。 */
  targetVariationIsActive: boolean;
  /** 純粋アセンブラ {@link assembleApprovalChain} に渡す組立て入力。 */
  assemblerInput: AssembleApprovalChainInput;
  /** 役割DTO（id→roleName/positionName 引き）。Preview のステップ表示名解決に使う。 */
  roleDtos: RoleDTO[];
};

/**
 * 承認チェーン組立ての越境読取りローダー（#417・Step 4）
 *
 * 申請プレビュー（クエリ）と申請実行（コマンド）が共有する「事実集め」。集約ルート Estimate と
 * 組織サブドメイン（product / employee / position / role）の QueryService を集約し、純粋アセンブラ
 * の入力を組み立てる（ADR-0030/0052: アプリ層が読み、ドメインは引数で受ける）。
 *
 * - `finalTotal` / `estimateType` / バリエーション有効性は `findById` 1 回で再構築される集約から読む。
 * - `leafCategories` は価格を持つ末端明細の商品区分をマスタ read-through で得る（ADR-0048）。
 * - 役職階層は4段単一鎖（ADR-0063）で、組織探索は有界。N+1 の性能問題は無い。
 *
 * 子エンティティ型（EstimateVariation）は境界規約（ADR-0027）により外へ漏らさず、必要な事実
 * （有効性）だけを `targetVariationIsActive` として返す。
 *
 * @throws {NotFoundError} 見積が存在しない／対象バリエーションが見積配下に無い。
 */
export async function loadApprovalChainInputs(
  params: { estimateId: string; variationId: string; operatorEmployeeId: string },
  deps: ApprovalChainInputLoaderDeps
): Promise<LoadedApprovalChainInputs> {
  const estimate = await deps.estimateRepository.findById(new EstimateId(params.estimateId));
  if (estimate === null) {
    throw new NotFoundError("見積が見つかりません");
  }

  const variationId = new EstimateVariationId(params.variationId);
  const variation = estimate.variations.find((v) => v.id.equals(variationId));
  if (variation === undefined) {
    throw new NotFoundError("対象のバリエーションが見つかりません");
  }

  // 価格を持つ末端明細の商品区分（read-through・ADR-0048）。同一商品は1回だけ問い合わせる。
  const pricedProductIds = Array.from(
    new Set(
      variation.items
        .filter((item) => !item.finalAmount.isZero())
        .map((item) => item.productId.value)
    )
  );
  const products =
    pricedProductIds.length === 0 ? [] : await deps.productQueryService.findByIds(pricedProductIds);
  const leafCategories = products.map((product) => ProductCategory.from(product.category));

  // 役職階層グラフ（深度→段階の解決に使う・ADR-0063）。
  const positionDtos = await deps.positionQueryService.findAll();
  const positions: PositionHierarchyNode[] = positionDtos.map((p) => ({
    positionId: new PositionId(p.id),
    superiorPositionId: p.superiorPositionId === null ? null : new PositionId(p.superiorPositionId),
  }));

  // 役割グラフ（承認チェーン走査に使う）と、各役割のメンバー有無。
  const roleDtos = await deps.roleQueryService.findAll();
  const roles: AssembleApprovalChainRole[] = roleDtos.map((r) => ({
    roleId: new RoleId(r.id),
    superiorRoleId: r.superiorRoleId === null ? null : new RoleId(r.superiorRoleId),
    positionId: new PositionId(r.positionId),
  }));
  const roleIdsWithMembers = await deps.roleQueryService.findRoleIdsWithMembers(
    roleDtos.map((r) => r.id)
  );

  // 申請者の上位役割＝承認フローの起点（§5.1）。
  const superiorRoleId = await deps.employeeQueryService.findSuperiorRoleId(
    params.operatorEmployeeId
  );
  const applicantSuperiorRoleId = superiorRoleId === null ? null : new RoleId(superiorRoleId);

  const assemblerInput: AssembleApprovalChainInput = {
    finalTotal: variation.finalTotal,
    leafCategories,
    estimateType: estimate.estimateType,
    positions,
    roles,
    roleIdsWithMembers,
    applicantSuperiorRoleId,
  };

  return {
    estimate,
    targetVariationIsActive: variation.isActive(),
    assemblerInput,
    roleDtos,
  };
}
