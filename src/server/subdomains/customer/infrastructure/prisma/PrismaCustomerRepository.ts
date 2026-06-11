import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import prisma from "@server/prisma";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CustomerMapper } from "@subdomains/customer/infrastructure/mappers/CustomerMapper";

export class PrismaCustomerRepository implements CustomerRepository {
  async save(customer: Customer): Promise<Customer> {
    const existing = await prisma.customer.findUnique({
      where: { id: customer.id.value },
    });

    const prismaCustomer = existing
      ? await prisma.customer.update({
          where: { id: customer.id.value },
          data: CustomerMapper.toPrismaUpdate(customer),
        })
      : await prisma.customer.create({
          data: CustomerMapper.toPrismaCreate(customer),
        });

    return CustomerMapper.toDomain(prismaCustomer);
  }

  async delete(id: CustomerId): Promise<void> {
    await prisma.customer.delete({
      where: { id: id.value },
    });
  }

  async findById(id: CustomerId): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id: id.value },
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }

  async findByCode(code: CompanyCode): Promise<Customer | null> {
    // 平坦化後（ADR-0043）は code が customers テーブルの一意列。型内一意なので
    // 旧 CTI のような company join / type 絞り込みは不要。
    const prismaCustomer = await prisma.customer.findUnique({
      where: { code: code.value },
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }
}
