import { SetProductRelationsCommand } from "../commands/SetProductRelationsCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";

export function setProductRelationsCommandFactory(): SetProductRelationsCommand {
  const repository = new PrismaProductRepository();
  return new SetProductRelationsCommand(repository);
}
