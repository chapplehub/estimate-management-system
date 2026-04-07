import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyType } from "@generated/prisma/client";
import prisma from "@server/prisma";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { CustomerMapper } from "@subdomains/customer/infrastructure/mappers/CustomerMapper";

const INCLUDE_COMPANY = { company: true } as const;

export class PrismaCustomerRepository implements CustomerRepository {
  async save(customer: Customer): Promise<Customer> {
    const existing = await prisma.customer.findUnique({
      where: { id: customer.id.value },
    });

    let prismaCustomer;

    if (existing) {
      prismaCustomer = await prisma.customer.update({
        where: { id: customer.id.value },
        data: CustomerMapper.toPrismaUpdate(customer),
        include: INCLUDE_COMPANY,
      });
    } else {
      prismaCustomer = await prisma.customer.create({
        data: CustomerMapper.toPrismaCreate(customer),
        include: INCLUDE_COMPANY,
      });
    }

    return CustomerMapper.toDomain(prismaCustomer);
  }

  async delete(id: CustomerId): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: id.value },
      select: { companyId: true },
    });

    if (customer) {
      // Company をカスケード削除（Company削除でCustomerも削除される）
      await prisma.company.delete({
        where: { id: customer.companyId },
      });
    }
  }

  async findById(id: CustomerId): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id: id.value },
      include: INCLUDE_COMPANY,
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }

  async findByCode(code: CompanyCode): Promise<Customer | null> {
    const prismaCustomer = await prisma.customer.findFirst({
      where: {
        company: {
          code: code.value,
          type: CompanyType.CUSTOMER,
        },
      },
      include: INCLUDE_COMPANY,
    });

    return prismaCustomer ? CustomerMapper.toDomain(prismaCustomer) : null;
  }
}
