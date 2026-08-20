import { ActivateProductCommand } from "../commands/ActivateProductCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";

export function activateProductCommandFactory(): ActivateProductCommand {
  const repository = new PrismaProductRepository();
  return new ActivateProductCommand(repository);
}
