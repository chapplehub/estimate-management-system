import { DeactivateProductCommand } from "../commands/DeactivateProductCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";

export function deactivateProductCommandFactory(): DeactivateProductCommand {
  const repository = new PrismaProductRepository();
  return new DeactivateProductCommand(repository);
}
