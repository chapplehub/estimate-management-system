import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationMapper } from "@subdomains/delivery-location/infrastructure/mappers/DeliveryLocationMapper";

export class PrismaDeliveryLocationRepository implements DeliveryLocationRepository {
  /**
   * 納品先を新規作成（version は @default(1)）
   */
  async insert(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation> {
    const prismaDeliveryLocation = await prisma.deliveryLocation.create({
      data: DeliveryLocationMapper.toPrismaCreate(deliveryLocation),
    });

    return DeliveryLocationMapper.toDomain(prismaDeliveryLocation);
  }

  /**
   * 既存納品先を更新（楽観ロック / ADR-0039）
   *
   * WHERE id AND version の条件付き UPDATE で「比較→更新」を DB 上で原子化し、
   * 成功時に version を +1 する。count = 0 は「version 不一致（先行更新あり）」と
   * 「行の消失（削除済み）」の両方を含むが、UPDATE 文からは区別できないため
   * 両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param expectedVersion 編集画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async update(
    deliveryLocation: DeliveryLocation,
    expectedVersion: number
  ): Promise<DeliveryLocation> {
    const result = await prisma.deliveryLocation.updateMany({
      where: { id: deliveryLocation.id.value, version: expectedVersion },
      data: {
        ...DeliveryLocationMapper.toPrismaUpdate(deliveryLocation),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }

    // version を進めた最新行を読み直して返す
    const row = await prisma.deliveryLocation.findUnique({
      where: { id: deliveryLocation.id.value },
    });
    if (!row) {
      throw new Error(`保存した納品先の再取得に失敗しました: ${deliveryLocation.id.value}`);
    }

    return DeliveryLocationMapper.toDomain(row);
  }

  async delete(id: DeliveryLocationId): Promise<void> {
    await prisma.deliveryLocation.delete({
      where: { id: id.value },
    });
  }

  async findById(id: DeliveryLocationId): Promise<DeliveryLocation | null> {
    const prismaDeliveryLocation = await prisma.deliveryLocation.findUnique({
      where: { id: id.value },
    });

    return prismaDeliveryLocation ? DeliveryLocationMapper.toDomain(prismaDeliveryLocation) : null;
  }

  async findByCode(code: CompanyCode): Promise<DeliveryLocation | null> {
    // 平坦化後（ADR-0043）は code が delivery_locations の一意列。型内一意なので
    // 旧 CTI のような company join / type 絞り込みは不要。
    const prismaDeliveryLocation = await prisma.deliveryLocation.findUnique({
      where: { code: code.value },
    });

    return prismaDeliveryLocation ? DeliveryLocationMapper.toDomain(prismaDeliveryLocation) : null;
  }
}
