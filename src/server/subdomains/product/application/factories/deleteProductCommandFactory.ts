import { DeleteProductCommand } from "../commands/DeleteProductCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";
import { ProductDeletionCheckDomainService } from "../../domain/services/ProductDeletionCheckDomainService";

export function deleteProductCommandFactory(): DeleteProductCommand {
  const repository = new PrismaProductRepository();
  const deletionCheck = new ProductDeletionCheckDomainService(repository);
  return new DeleteProductCommand(repository, deletionCheck);
}
