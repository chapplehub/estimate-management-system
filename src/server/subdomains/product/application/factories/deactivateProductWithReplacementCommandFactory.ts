import { DeactivateProductWithReplacementCommand } from "../commands/DeactivateProductWithReplacementCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";
import { ProductReplacementDomainService } from "../../domain/services/ProductReplacementDomainService";

export function deactivateProductWithReplacementCommandFactory(): DeactivateProductWithReplacementCommand {
  const repository = new PrismaProductRepository();
  const replacementDomainService = new ProductReplacementDomainService();
  return new DeactivateProductWithReplacementCommand(repository, replacementDomainService);
}
