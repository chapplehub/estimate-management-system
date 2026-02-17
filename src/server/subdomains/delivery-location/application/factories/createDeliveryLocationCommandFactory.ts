import { CreateDeliveryLocationCommand } from "../commands/CreateDeliveryLocationCommand";
import { DeliveryLocationCodeDuplicationCheckDomainService } from "../../domain/services/DeliveryLocationCodeDuplicationCheckDomainService";
import { PrismaDeliveryLocationRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationRepository";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";

export function createDeliveryLocationCommandFactory(): CreateDeliveryLocationCommand {
  const deliveryLocationRepository = new PrismaDeliveryLocationRepository();
  const customerRepository = new PrismaCustomerRepository();

  return new CreateDeliveryLocationCommand(
    deliveryLocationRepository,
    customerRepository,
    new DeliveryLocationCodeDuplicationCheckDomainService(deliveryLocationRepository)
  );
}
