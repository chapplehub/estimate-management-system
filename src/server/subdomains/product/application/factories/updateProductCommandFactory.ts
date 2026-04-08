import { UpdateProductCommand } from "../commands/UpdateProductCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";
import { ProductCodeDuplicationCheckDomainService } from "../../domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "../../domain/services/ProductNameDuplicationCheckDomainService";

export function updateProductCommandFactory(): UpdateProductCommand {
  const repository = new PrismaProductRepository();
  const codeDuplicationCheck = new ProductCodeDuplicationCheckDomainService(repository);
  const nameDuplicationCheck = new ProductNameDuplicationCheckDomainService(repository);
  return new UpdateProductCommand(repository, codeDuplicationCheck, nameDuplicationCheck);
}
