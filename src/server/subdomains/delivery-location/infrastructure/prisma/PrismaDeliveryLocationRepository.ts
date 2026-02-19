import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyType } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationMapper } from "@subdomains/delivery-location/infrastructure/mappers/DeliveryLocationMapper";

const INCLUDE_COMPANY = { company: true } as const;

export class PrismaDeliveryLocationRepository implements DeliveryLocationRepository {
  async save(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation> {
    const existing = await prisma.deliveryLocation.findUnique({
      where: { id: deliveryLocation.id },
    });

    let prismaDeliveryLocation;

    if (existing) {
      prismaDeliveryLocation = await prisma.deliveryLocation.update({
        where: { id: deliveryLocation.id },
        data: DeliveryLocationMapper.toPrismaUpdate(deliveryLocation),
        include: INCLUDE_COMPANY,
      });
    } else {
      prismaDeliveryLocation = await prisma.deliveryLocation.create({
        data: DeliveryLocationMapper.toPrismaCreate(deliveryLocation),
        include: INCLUDE_COMPANY,
      });
    }

    return DeliveryLocationMapper.toDomain(prismaDeliveryLocation);
  }

  async delete(id: string): Promise<void> {
    const deliveryLocation = await prisma.deliveryLocation.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (deliveryLocation) {
      await prisma.company.delete({
        where: { id: deliveryLocation.companyId },
      });
    }
  }

  async findById(id: string): Promise<DeliveryLocation | null> {
    const prismaDeliveryLocation = await prisma.deliveryLocation.findUnique({
      where: { id },
      include: INCLUDE_COMPANY,
    });

    return prismaDeliveryLocation ? DeliveryLocationMapper.toDomain(prismaDeliveryLocation) : null;
  }

  async findByCode(code: CompanyCode): Promise<DeliveryLocation | null> {
    const prismaDeliveryLocation = await prisma.deliveryLocation.findFirst({
      where: {
        company: {
          code: code.value,
          type: CompanyType.DELIVERY_LOCATION,
        },
      },
      include: INCLUDE_COMPANY,
    });

    return prismaDeliveryLocation ? DeliveryLocationMapper.toDomain(prismaDeliveryLocation) : null;
  }
}
