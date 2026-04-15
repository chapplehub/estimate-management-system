import { DeactivateDeliveryLocationCommand } from "../commands/DeactivateDeliveryLocationCommand";
import { PrismaDeliveryLocationRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationRepository";

export function deactivateDeliveryLocationCommandFactory(): DeactivateDeliveryLocationCommand {
  return new DeactivateDeliveryLocationCommand(new PrismaDeliveryLocationRepository());
}
