import { DeliveryLocationDTO } from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationDTO";
import {
  DeliveryLocationSearchCriteria,
  DeliveryLocationListOptions,
} from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationSearchCriteria";
import { DeliveryLocationQueryService } from "@subdomains/delivery-location/application/queries/DeliveryLocationQueryService";
import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";

export class PrismaDeliveryLocationQueryService implements DeliveryLocationQueryService {
  async findById(id: string): Promise<DeliveryLocationDTO | null> {
    const dl = await prisma.deliveryLocation.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return dl ? this.toDTO(dl) : null;
  }

  async findByCode(code: string): Promise<DeliveryLocationDTO | null> {
    // 平坦化後（ADR-0043）は code が delivery_locations の一意列。型内一意なので findUnique で足りる。
    const dl = await prisma.deliveryLocation.findUnique({
      where: { code },
      select: this.getSelectFields(),
    });

    return dl ? this.toDTO(dl) : null;
  }

  async search(
    criteria: DeliveryLocationSearchCriteria,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const dls = await prisma.deliveryLocation.findMany({
      where,
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return dls.map((dl) => this.toDTO(dl));
  }

  private buildWhereClause(
    criteria: DeliveryLocationSearchCriteria
  ): Prisma.DeliveryLocationWhereInput {
    const where: Prisma.DeliveryLocationWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.code) {
      where.code = criteria.code;
    }

    if (criteria.isActive !== undefined) {
      where.isActive = criteria.isActive;
    }

    if (criteria.customerId) {
      where.customerId = criteria.customerId;
    }

    return where;
  }

  private buildOrderBy(
    options?: DeliveryLocationListOptions
  ): Prisma.DeliveryLocationOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    const { field, direction } = options.orderBy;

    return { [field]: direction };
  }

  private getSelectFields() {
    return {
      id: true,
      code: true,
      name: true,
      postalCode: true,
      prefecture: true,
      address: true,
      phoneNumber: true,
      faxNumber: true,
      contactPerson: true,
      isActive: true,
      customerId: true,
      deliveryNotes: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      // 親得意先の名称・コード（一覧DTOにリレーション先名を含める / ADR-0013）
      customer: {
        select: {
          name: true,
          code: true,
        },
      },
    } as const;
  }

  private toDTO(dl: {
    id: string;
    code: string;
    name: string;
    postalCode: string | null;
    prefecture: string | null;
    address: string | null;
    phoneNumber: string | null;
    faxNumber: string | null;
    contactPerson: string | null;
    isActive: boolean;
    customerId: string;
    deliveryNotes: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    customer: {
      name: string;
      code: string;
    };
  }): DeliveryLocationDTO {
    return {
      id: dl.id,
      code: dl.code,
      name: dl.name,
      postalCode: dl.postalCode,
      prefecture: dl.prefecture,
      address: dl.address,
      phoneNumber: dl.phoneNumber,
      faxNumber: dl.faxNumber,
      contactPerson: dl.contactPerson,
      isActive: dl.isActive,
      customerId: dl.customerId,
      customerName: dl.customer.name,
      customerCode: dl.customer.code,
      deliveryNotes: dl.deliveryNotes,
      version: dl.version,
      createdAt: dl.createdAt,
      updatedAt: dl.updatedAt,
    };
  }
}
