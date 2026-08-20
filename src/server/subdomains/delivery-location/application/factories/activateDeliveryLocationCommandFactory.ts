import { ActivateDeliveryLocationCommand } from "../commands/ActivateDeliveryLocationCommand";
import { PrismaDeliveryLocationRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationRepository";

export function activateDeliveryLocationCommandFactory(): ActivateDeliveryLocationCommand {
  return new ActivateDeliveryLocationCommand(new PrismaDeliveryLocationRepository());
}
