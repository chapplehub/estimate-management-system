import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Estimate } from "@subdomains/estimate/domain/entities";
import { EstimateRepository } from "@subdomains/estimate/domain/repositories/EstimateRepository";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";

/**
 * バリエーション無効化コマンドの入力。
 *
 * 集約は estimateId からのみロードできるため対象特定に variationId を併せて受け取る。
 */
export type DeactivateVariationInput = {
  estimateId: string;
  variationId: string;
  /** 画面表示時に取得した親見積の楽観ロックトークン（ADR-0039）。フォーム往復で持ち回る */
  expectedVersion: number;
};

/**
 * バリエーション無効化コマンド（ADR-0018 で有効化と分離）。
 *
 * 流れ: 既存集約をロード → 進行ロックの拡張点 assertDeactivatable で可否確認 →
 * ルート deactivateVariation で status を INACTIVE に → version 付きで保存。無効化は
 * 金額・税額を動かさないため税率整合チェック（checkTaxRateThenSave）を通さない素の
 * update とする（UpdateVariationMemosCommand と同型・ADR-0037 で戻り値は保存済み集約）。
 *
 * 冪等: 既に INACTIVE でもドメインが status を上書きするだけでエラーにしない。並行競合は
 * ルート version の ConflictError（ADR-0039）が防御するため本コマンドで特別扱いしない。
 */
export class DeactivateVariationCommand {
  constructor(private readonly estimateRepository: EstimateRepository) {}

  async execute(input: DeactivateVariationInput): Promise<Estimate> {
    const estimate = await this.estimateRepository.findById(new EstimateId(input.estimateId));
    if (!estimate) {
      throw new NotFoundEntityError(Estimate, { id: input.estimateId });
    }

    const variationId = new EstimateVariationId(input.variationId);
    await this.assertDeactivatable(input.estimateId, input.variationId);
    estimate.deactivateVariation(variationId);

    return this.estimateRepository.update(estimate, input.expectedVersion);
  }

  /**
   * 進行ロックの拡張点（ADR-0061・案 X、現状 no-op）。
   *
   * 接続先は表示ステータス由来の単一述語 isCommitted（＝進行ロック）。表示ステータスが
   * {申請中, 承認済, 承認不要, 受注作成済, 受注確定済, 受注取消済} のいずれかなら無効化を
   * 拒否する。判定材料（申請・免除・受注の各イベント行）は Estimate 集約の外にあるため
   * （ADR-0053/0058）、申請テーブルの read model が揃った時点で EstimateApplicationStatus
   * QueryService（仮）を DI し、ここで表示ステータスを引いて拒否判定を埋める（ADR-0056 型）。
   * 有効化側にはこのガードは無い。メモ編集は進行ロックを貫通する（ADR-0059 の一般化）。
   */
  private async assertDeactivatable(_estimateId: string, _variationId: string): Promise<void> {
    // no-op: 申請テーブル接続まで進行ロックは判定しない（ADR-0061 の #335 スコープ）
  }
}
