import { UpdateCustomerCommand } from "../commands/UpdateCustomerCommand";
import { PrismaCustomerRepository } from "../../infrastructure/prisma/PrismaCustomerRepository";

export function updateCustomerCommandFactory(): UpdateCustomerCommand {
  const repository = new PrismaCustomerRepository();
  return new UpdateCustomerCommand(repository);
}
