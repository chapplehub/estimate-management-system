import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import prisma from "@server/prisma";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryLocationMapper } from "@subdomains/delivery-location/infrastructure/mappers/DeliveryLocationMapper";

export class PrismaDeliveryLocationRepository implements DeliveryLocationRepository {
  async save(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation> {
    const existing = await prisma.deliveryLocation.findUnique({
      where: { id: deliveryLocation.id.value },
    });

    const prismaDeliveryLocation = existing
      ? await prisma.deliveryLocation.update({
          where: { id: deliveryLocation.id.value },
          data: DeliveryLocationMapper.toPrismaUpdate(deliveryLocation),
        })
      : await prisma.deliveryLocation.create({
          data: DeliveryLocationMapper.toPrismaCreate(deliveryLocation),
        });

    return DeliveryLocationMapper.toDomain(prismaDeliveryLocation);
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
