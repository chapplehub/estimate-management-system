import { CreateProductCommand } from "../commands/CreateProductCommand";
import { PrismaProductRepository } from "../../infrastructure/prisma/PrismaProductRepository";
import { ProductCodeDuplicationCheckDomainService } from "../../domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "../../domain/services/ProductNameDuplicationCheckDomainService";

export function createProductCommandFactory(): CreateProductCommand {
  const repository = new PrismaProductRepository();
  const codeDuplicationCheck = new ProductCodeDuplicationCheckDomainService(repository);
  const nameDuplicationCheck = new ProductNameDuplicationCheckDomainService(repository);
  return new CreateProductCommand(repository, codeDuplicationCheck, nameDuplicationCheck);
}
