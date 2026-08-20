import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import type { Customer as PrismaCustomer } from "@generated/prisma/client";

/**
 * CustomerMapper
 *
 * 平坦化後（ADR-0043）の customers テーブル行とドメインエンティティを相互変換する。
 * 取引先共通属性は customers 自テーブルが直接保持する（companies 基底は廃止）。
 */
export class CustomerMapper {
  static toDomain(data: PrismaCustomer): Customer {
    return Customer.reconstruct(
      new CustomerId(data.id),
      new CompanyCode(data.code),
      new CompanyName(data.name),
      data.postalCode ? new PostalCode(data.postalCode) : null,
      data.prefecture ? new Prefecture(data.prefecture) : null,
      data.address ? new Address(data.address) : null,
      data.phoneNumber ? new PhoneNumber(data.phoneNumber) : null,
      data.faxNumber ? new FaxNumber(data.faxNumber) : null,
      data.contactPerson,
      data.isActive,
      data.createdAt,
      data.updatedAt
    );
  }

  static toPrismaCreate(customer: Customer) {
    return {
      id: customer.id.value,
      code: customer.code.value,
      name: customer.name.value,
      postalCode: customer.postalCode?.value ?? null,
      prefecture: customer.prefecture?.value ?? null,
      address: customer.address?.value ?? null,
      phoneNumber: customer.phoneNumber?.value ?? null,
      faxNumber: customer.faxNumber?.value ?? null,
      contactPerson: customer.contactPerson,
      isActive: customer.isActive,
    };
  }

  static toPrismaUpdate(customer: Customer) {
    return {
      name: customer.name.value,
      postalCode: customer.postalCode?.value ?? null,
      prefecture: customer.prefecture?.value ?? null,
      address: customer.address?.value ?? null,
      phoneNumber: customer.phoneNumber?.value ?? null,
      faxNumber: customer.faxNumber?.value ?? null,
      contactPerson: customer.contactPerson,
      isActive: customer.isActive,
      updatedAt: customer.updatedAt,
    };
  }
}
