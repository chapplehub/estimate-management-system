import { DeleteDeliveryLocationCommand } from "../commands/DeleteDeliveryLocationCommand";
import { PrismaDeliveryLocationRepository } from "../../infrastructure/prisma/PrismaDeliveryLocationRepository";

export function deleteDeliveryLocationCommandFactory(): DeleteDeliveryLocationCommand {
  return new DeleteDeliveryLocationCommand(new PrismaDeliveryLocationRepository());
}
