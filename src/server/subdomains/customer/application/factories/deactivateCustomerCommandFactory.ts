import { DeactivateCustomerCommand } from "../commands/DeactivateCustomerCommand";
import { PrismaCustomerRepository } from "../../infrastructure/prisma/PrismaCustomerRepository";

export function deactivateCustomerCommandFactory(): DeactivateCustomerCommand {
  const repository = new PrismaCustomerRepository();
  return new DeactivateCustomerCommand(repository);
}
