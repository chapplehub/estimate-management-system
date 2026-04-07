import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyId } from "@server/shared/domain/values/CompanyId";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";
import type { Company, DeliveryLocation as PrismaDeliveryLocation } from "@generated/prisma/client";
import { CompanyType } from "@generated/prisma/client";

type PrismaDeliveryLocationWithCompany = PrismaDeliveryLocation & {
  company: Company;
};

/**
 * DeliveryLocationMapper
 *
 * Company + DeliveryLocation の複合データとドメインエンティティを相互変換する
 */
export class DeliveryLocationMapper {
  static toDomain(data: PrismaDeliveryLocationWithCompany): DeliveryLocation {
    return DeliveryLocation.reconstruct(
      new DeliveryLocationId(data.id),
      new CompanyId(data.companyId),
      new CompanyCode(data.company.code),
      new CompanyName(data.company.name),
      data.company.postalCode ? new PostalCode(data.company.postalCode) : null,
      data.company.prefecture ? new Prefecture(data.company.prefecture) : null,
      data.company.address ? new Address(data.company.address) : null,
      data.company.phoneNumber ? new PhoneNumber(data.company.phoneNumber) : null,
      data.company.faxNumber ? new FaxNumber(data.company.faxNumber) : null,
      data.company.contactPerson,
      data.company.isActive,
      new CustomerId(data.customerId),
      data.deliveryNotes ? new DeliveryNotes(data.deliveryNotes) : null,
      data.createdAt,
      data.updatedAt
    );
  }

  static toPrismaCreate(deliveryLocation: DeliveryLocation) {
    return {
      id: deliveryLocation.id.value,
      customer: {
        connect: { id: deliveryLocation.customerId.value },
      },
      deliveryNotes: deliveryLocation.deliveryNotes?.value ?? null,
      company: {
        create: {
          id: deliveryLocation.companyId.value,
          code: deliveryLocation.code.value,
          name: deliveryLocation.name.value,
          type: CompanyType.DELIVERY_LOCATION,
          postalCode: deliveryLocation.postalCode?.value ?? null,
          prefecture: deliveryLocation.prefecture?.value ?? null,
          address: deliveryLocation.address?.value ?? null,
          phoneNumber: deliveryLocation.phoneNumber?.value ?? null,
          faxNumber: deliveryLocation.faxNumber?.value ?? null,
          contactPerson: deliveryLocation.contactPerson,
          isActive: deliveryLocation.isActive,
        },
      },
    };
  }

  static toPrismaUpdate(deliveryLocation: DeliveryLocation) {
    return {
      deliveryNotes: deliveryLocation.deliveryNotes?.value ?? null,
      updatedAt: deliveryLocation.updatedAt,
      company: {
        update: {
          name: deliveryLocation.name.value,
          postalCode: deliveryLocation.postalCode?.value ?? null,
          prefecture: deliveryLocation.prefecture?.value ?? null,
          address: deliveryLocation.address?.value ?? null,
          phoneNumber: deliveryLocation.phoneNumber?.value ?? null,
          faxNumber: deliveryLocation.faxNumber?.value ?? null,
          contactPerson: deliveryLocation.contactPerson,
          isActive: deliveryLocation.isActive,
        },
      },
    };
  }
}
