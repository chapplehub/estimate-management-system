import { SetProductComponentsCommand } from "../commands/SetProductComponentsCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";

export function setProductComponentsCommandFactory(): SetProductComponentsCommand {
  const repository = new PrismaProductRepository();
  return new SetProductComponentsCommand(repository);
}
