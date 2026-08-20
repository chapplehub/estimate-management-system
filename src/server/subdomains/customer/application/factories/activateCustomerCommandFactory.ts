import { ActivateCustomerCommand } from "../commands/ActivateCustomerCommand";
import { PrismaCustomerRepository } from "../../infrastructure/prisma/PrismaCustomerRepository";

export function activateCustomerCommandFactory(): ActivateCustomerCommand {
  const repository = new PrismaCustomerRepository();
  return new ActivateCustomerCommand(repository);
}
