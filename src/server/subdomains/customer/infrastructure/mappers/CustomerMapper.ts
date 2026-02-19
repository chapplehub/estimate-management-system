import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";
import type { Company, Customer as PrismaCustomer } from "@generated/prisma/client";
import { CompanyType, Prisma } from "@generated/prisma/client";

type PrismaCustomerWithCompany = PrismaCustomer & {
  company: Company;
};

/**
 * CustomerMapper
 *
 * Company + Customer の複合データとドメインエンティティを相互変換する
 */
export class CustomerMapper {
  static toDomain(data: PrismaCustomerWithCompany): Customer {
    return Customer.reconstruct(
      data.id,
      data.companyId,
      new CompanyCode(data.company.code),
      new CompanyName(data.company.name),
      data.company.postalCode ? new PostalCode(data.company.postalCode) : null,
      data.company.prefecture ? new Prefecture(data.company.prefecture) : null,
      data.company.address ? new Address(data.company.address) : null,
      data.company.phoneNumber ? new PhoneNumber(data.company.phoneNumber) : null,
      data.company.faxNumber ? new FaxNumber(data.company.faxNumber) : null,
      data.company.contactPerson,
      data.company.isActive,
      data.marginRate !== null ? new MarginRate(Number(data.marginRate)) : null,
      data.createdAt,
      data.updatedAt
    );
  }

  static toPrismaCreate(customer: Customer) {
    return {
      id: customer.id,
      marginRate:
        customer.marginRate !== null ? new Prisma.Decimal(customer.marginRate.value) : null,
      company: {
        create: {
          id: customer.companyId,
          code: customer.code.value,
          name: customer.name.value,
          type: CompanyType.CUSTOMER,
          postalCode: customer.postalCode?.value ?? null,
          prefecture: customer.prefecture?.value ?? null,
          address: customer.address?.value ?? null,
          phoneNumber: customer.phoneNumber?.value ?? null,
          faxNumber: customer.faxNumber?.value ?? null,
          contactPerson: customer.contactPerson,
          isActive: customer.isActive,
        },
      },
    };
  }

  static toPrismaUpdate(customer: Customer) {
    return {
      marginRate:
        customer.marginRate !== null ? new Prisma.Decimal(customer.marginRate.value) : null,
      updatedAt: customer.updatedAt,
      company: {
        update: {
          name: customer.name.value,
          postalCode: customer.postalCode?.value ?? null,
          prefecture: customer.prefecture?.value ?? null,
          address: customer.address?.value ?? null,
          phoneNumber: customer.phoneNumber?.value ?? null,
          faxNumber: customer.faxNumber?.value ?? null,
          contactPerson: customer.contactPerson,
          isActive: customer.isActive,
        },
      },
    };
  }
}
