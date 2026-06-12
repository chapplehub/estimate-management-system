import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";
import type { DeliveryLocation as PrismaDeliveryLocation } from "@generated/prisma/client";

/**
 * DeliveryLocationMapper
 *
 * 平坦化後（ADR-0043）の delivery_locations テーブル行とドメインエンティティを相互変換する。
 * 取引先共通属性は delivery_locations 自テーブルが直接保持する（companies 基底は廃止）。
 */
export class DeliveryLocationMapper {
  static toDomain(data: PrismaDeliveryLocation): DeliveryLocation {
    return DeliveryLocation.reconstruct(
      new DeliveryLocationId(data.id),
      new CompanyCode(data.code),
      new CompanyName(data.name),
      data.postalCode ? new PostalCode(data.postalCode) : null,
      data.prefecture ? new Prefecture(data.prefecture) : null,
      data.address ? new Address(data.address) : null,
      data.phoneNumber ? new PhoneNumber(data.phoneNumber) : null,
      data.faxNumber ? new FaxNumber(data.faxNumber) : null,
      data.contactPerson,
      data.isActive,
      new CustomerId(data.customerId),
      data.deliveryNotes ? new DeliveryNotes(data.deliveryNotes) : null,
      data.createdAt,
      data.updatedAt
    );
  }

  static toPrismaCreate(deliveryLocation: DeliveryLocation) {
    return {
      id: deliveryLocation.id.value,
      code: deliveryLocation.code.value,
      name: deliveryLocation.name.value,
      postalCode: deliveryLocation.postalCode?.value ?? null,
      prefecture: deliveryLocation.prefecture?.value ?? null,
      address: deliveryLocation.address?.value ?? null,
      phoneNumber: deliveryLocation.phoneNumber?.value ?? null,
      faxNumber: deliveryLocation.faxNumber?.value ?? null,
      contactPerson: deliveryLocation.contactPerson,
      isActive: deliveryLocation.isActive,
      customerId: deliveryLocation.customerId.value,
      deliveryNotes: deliveryLocation.deliveryNotes?.value ?? null,
    };
  }

  static toPrismaUpdate(deliveryLocation: DeliveryLocation) {
    return {
      name: deliveryLocation.name.value,
      postalCode: deliveryLocation.postalCode?.value ?? null,
      prefecture: deliveryLocation.prefecture?.value ?? null,
      address: deliveryLocation.address?.value ?? null,
      phoneNumber: deliveryLocation.phoneNumber?.value ?? null,
      faxNumber: deliveryLocation.faxNumber?.value ?? null,
      contactPerson: deliveryLocation.contactPerson,
      isActive: deliveryLocation.isActive,
      deliveryNotes: deliveryLocation.deliveryNotes?.value ?? null,
      updatedAt: deliveryLocation.updatedAt,
    };
  }
}
