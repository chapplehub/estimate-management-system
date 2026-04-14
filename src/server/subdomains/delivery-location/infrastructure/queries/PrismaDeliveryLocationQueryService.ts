import { DeliveryLocationDTO } from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationDTO";
import {
  DeliveryLocationSearchCriteria,
  DeliveryLocationListOptions,
} from "@subdomains/delivery-location/application/queries/dto/DeliveryLocationSearchCriteria";
import { DeliveryLocationQueryService } from "@subdomains/delivery-location/application/queries/DeliveryLocationQueryService";
import prisma from "@server/prisma";
import { CompanyType, Prisma } from "@generated/prisma/client";

export class PrismaDeliveryLocationQueryService implements DeliveryLocationQueryService {
  async findById(id: string): Promise<DeliveryLocationDTO | null> {
    const dl = await prisma.deliveryLocation.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return dl ? this.toDTO(dl) : null;
  }

  async findByCode(code: string): Promise<DeliveryLocationDTO | null> {
    const dl = await prisma.deliveryLocation.findFirst({
      where: {
        company: { code, type: CompanyType.DELIVERY_LOCATION },
      },
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
    const companyWhere: Prisma.CompanyWhereInput = { type: CompanyType.DELIVERY_LOCATION };

    if (criteria.name) {
      companyWhere.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.code) {
      companyWhere.code = criteria.code;
    }

    if (criteria.isActive !== undefined) {
      companyWhere.isActive = criteria.isActive;
    }

    if (criteria.customerId) {
      where.customerId = criteria.customerId;
    }

    where.company = companyWhere;
    return where;
  }

  private buildOrderBy(
    options?: DeliveryLocationListOptions
  ): Prisma.DeliveryLocationOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    const { field, direction } = options.orderBy;

    if (field === "name" || field === "code") {
      return { company: { [field]: direction } };
    }

    return { [field]: direction };
  }

  private getSelectFields() {
    return {
      id: true,
      customerId: true,
      deliveryNotes: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          code: true,
          name: true,
          postalCode: true,
          prefecture: true,
          address: true,
          phoneNumber: true,
          faxNumber: true,
          contactPerson: true,
          isActive: true,
        },
      },
      customer: {
        select: {
          company: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
    } as const;
  }

  private toDTO(dl: {
    id: string;
    customerId: string;
    deliveryNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    company: {
      code: string;
      name: string;
      postalCode: string | null;
      prefecture: string | null;
      address: string | null;
      phoneNumber: string | null;
      faxNumber: string | null;
      contactPerson: string | null;
      isActive: boolean;
    };
    customer: {
      company: {
        name: string;
        code: string;
      };
    };
  }): DeliveryLocationDTO {
    return {
      id: dl.id,
      code: dl.company.code,
      name: dl.company.name,
      postalCode: dl.company.postalCode,
      prefecture: dl.company.prefecture,
      address: dl.company.address,
      phoneNumber: dl.company.phoneNumber,
      faxNumber: dl.company.faxNumber,
      contactPerson: dl.company.contactPerson,
      isActive: dl.company.isActive,
      customerId: dl.customerId,
      customerName: dl.customer.company.name,
      customerCode: dl.customer.company.code,
      deliveryNotes: dl.deliveryNotes,
      createdAt: dl.createdAt,
      updatedAt: dl.updatedAt,
    };
  }
}
