import { DeleteCustomerCommand } from "../commands/DeleteCustomerCommand";
import { PrismaCustomerRepository } from "../../infrastructure/prisma/PrismaCustomerRepository";

export function deleteCustomerCommandFactory(): DeleteCustomerCommand {
  const repository = new PrismaCustomerRepository();
  return new DeleteCustomerCommand(repository);
}
