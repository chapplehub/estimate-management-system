import { UpdateDeliveryLocationCommand } from "../commands/UpdateDeliveryLocationCommand";
import { PrismaDeliveryLocationRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationRepository";

export function updateDeliveryLocationCommandFactory(): UpdateDeliveryLocationCommand {
  return new UpdateDeliveryLocationCommand(new PrismaDeliveryLocationRepository());
}
