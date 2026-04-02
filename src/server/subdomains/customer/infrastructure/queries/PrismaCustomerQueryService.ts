import { CustomerDTO } from "@subdomains/customer/application/queries/dto/CustomerDTO";
import {
  CustomerSearchCriteria,
  CustomerListOptions,
} from "@subdomains/customer/application/queries/dto/CustomerSearchCriteria";
import { CustomerQueryService } from "@subdomains/customer/application/queries/CustomerQueryService";
import prisma from "@server/prisma";
import { CompanyType, Prisma } from "@generated/prisma/client";

export class PrismaCustomerQueryService implements CustomerQueryService {
  async findById(id: string): Promise<CustomerDTO | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return customer ? this.toDTO(customer) : null;
  }

  async findByCode(code: string): Promise<CustomerDTO | null> {
    const customer = await prisma.customer.findFirst({
      where: {
        company: { code, type: CompanyType.CUSTOMER },
      },
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
    const companyWhere: Prisma.CompanyWhereInput = { type: CompanyType.CUSTOMER };

    if (criteria.name) {
      companyWhere.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.code) {
      companyWhere.code = criteria.code;
    }

    if (criteria.isActive !== undefined) {
      companyWhere.isActive = criteria.isActive;
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

    where.company = companyWhere;
    return where;
  }

  private buildOrderBy(
    options?: CustomerListOptions
  ): Prisma.CustomerOrderByWithRelationInput | undefined {
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
      marginRate: true,
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
    } as const;
  }

  private toDTO(customer: {
    id: string;
    marginRate: Prisma.Decimal | null;
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
  }): CustomerDTO {
    return {
      id: customer.id,
      code: customer.company.code,
      name: customer.company.name,
      postalCode: customer.company.postalCode,
      prefecture: customer.company.prefecture,
      address: customer.company.address,
      phoneNumber: customer.company.phoneNumber,
      faxNumber: customer.company.faxNumber,
      contactPerson: customer.company.contactPerson,
      isActive: customer.company.isActive,
      marginRate: customer.marginRate !== null ? Number(customer.marginRate) : null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
