import { CreateCustomerCommand } from "../commands/CreateCustomerCommand";
import { CustomerCodeDuplicationCheckDomainService } from "../../domain/services/CustomerCodeDuplicationCheckDomainService";
import { PrismaCustomerRepository } from "../../infrastructure/prisma/PrismaCustomerRepository";

export function createCustomerCommandFactory(): CreateCustomerCommand {
  const repository = new PrismaCustomerRepository();

  return new CreateCustomerCommand(
    repository,
    new CustomerCodeDuplicationCheckDomainService(repository)
  );
}
