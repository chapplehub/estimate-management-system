import { CustomerDTO } from "@subdomains/customer/application/queries/dto/CustomerDTO";
import {
  CustomerSearchCriteria,
  CustomerListOptions,
} from "@subdomains/customer/application/queries/dto/CustomerSearchCriteria";
import { CustomerQueryService } from "@subdomains/customer/application/queries/CustomerQueryService";
import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";

export class PrismaCustomerQueryService implements CustomerQueryService {
  async findById(id: string): Promise<CustomerDTO | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return customer ? this.toDTO(customer) : null;
  }

  async findByCode(code: string): Promise<CustomerDTO | null> {
    // 平坦化後（ADR-0043）は code が customers の一意列。型内一意なので findUnique で足りる。
    const customer = await prisma.customer.findUnique({
      where: { code },
      select: this.getSelectFields(),
    });

    return customer ? this.toDTO(customer) : null;
  }

  async search(
    criteria: CustomerSearchCriteria,
    options?: CustomerListOptions
  ): Promise<CustomerDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const customers = await prisma.customer.findMany({
      where,
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return customers.map((c) => this.toDTO(c));
  }

  private buildWhereClause(criteria: CustomerSearchCriteria): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.code) {
      where.code = criteria.code;
    }

    if (criteria.postalCode) {
      where.postalCode = criteria.postalCode.replace(/-/g, "");
    }

    if (criteria.prefecture) {
      where.prefecture = criteria.prefecture;
    }

    if (criteria.address) {
      where.address = { contains: criteria.address, mode: "insensitive" };
    }

    if (criteria.phoneNumber) {
      where.phoneNumber = criteria.phoneNumber;
    }

    if (criteria.faxNumber) {
      where.faxNumber = criteria.faxNumber;
    }

    if (criteria.contactPerson) {
      where.contactPerson = { contains: criteria.contactPerson, mode: "insensitive" };
    }

    if (criteria.isActive !== undefined) {
      where.isActive = criteria.isActive;
    }

    if (criteria.createdAfter || criteria.createdBefore) {
      where.createdAt = {};
      if (criteria.createdAfter) {
        where.createdAt.gte = criteria.createdAfter;
      }
      if (criteria.createdBefore) {
        where.createdAt.lte = criteria.createdBefore;
      }
    }

    return where;
  }

  private buildOrderBy(
    options?: CustomerListOptions
  ): Prisma.CustomerOrderByWithRelationInput | undefined {
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
      marginRate: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toDTO(customer: {
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
    marginRate: Prisma.Decimal | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): CustomerDTO {
    return {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      postalCode: customer.postalCode,
      prefecture: customer.prefecture,
      address: customer.address,
      phoneNumber: customer.phoneNumber,
      faxNumber: customer.faxNumber,
      contactPerson: customer.contactPerson,
      isActive: customer.isActive,
      marginRate: customer.marginRate !== null ? Number(customer.marginRate) : null,
      version: customer.version,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
