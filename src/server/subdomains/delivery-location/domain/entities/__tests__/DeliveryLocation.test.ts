import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyId } from "@server/shared/domain/values/CompanyId";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";
import { describe, expect, it } from "vitest";
import { DeliveryLocation } from "../DeliveryLocation";

describe("DeliveryLocation Entity", () => {
  const CUSTOMER_ID = CustomerId.generate();

  const createTestDeliveryLocation = () =>
    DeliveryLocation.create(new CompanyCode("DL001"), new CompanyName("テスト納品先"), CUSTOMER_ID);

  describe("create", () => {
    it("必須項目のみで納品先を作成できる", () => {
      const dl = createTestDeliveryLocation();

      expect(dl.id).toBeTruthy();
      expect(dl.companyId).toBeTruthy();
      expect(dl.id).not.toBe(dl.companyId);
      expect(dl.code.value).toBe("DL001");
      expect(dl.name.value).toBe("テスト納品先");
      expect(dl.customerId.value).toBe(CUSTOMER_ID.value);
      expect(dl.isActive).toBe(true);
      expect(dl.deliveryNotes).toBeNull();
    });

    it("全オプションを指定して納品先を作成できる", () => {
      const dl = DeliveryLocation.create(
        new CompanyCode("DL002"),
        new CompanyName("テスト倉庫"),
        CUSTOMER_ID,
        {
          postalCode: new PostalCode("1234567"),
          prefecture: new Prefecture("東京都"),
          address: new Address("渋谷区1-2-3"),
          phoneNumber: new PhoneNumber("0312345678"),
          faxNumber: new FaxNumber("0312345679"),
          contactPerson: "田中太郎",
          deliveryNotes: new DeliveryNotes("午前中配送希望"),
        }
      );

      expect(dl.postalCode?.value).toBe("1234567");
      expect(dl.prefecture?.value).toBe("東京都");
      expect(dl.deliveryNotes?.value).toBe("午前中配送希望");
    });
  });

  describe("reconstruct", () => {
    it("DBからの再構築が正しく動作する", () => {
      const now = new Date();
      const id = DeliveryLocationId.generate();
      const companyId = CompanyId.generate();
      const dl = DeliveryLocation.reconstruct(
        id,
        companyId,
        new CompanyCode("DL001"),
        new CompanyName("テスト納品先"),
        null,
        null,
        null,
        null,
        null,
        null,
        true,
        CUSTOMER_ID,
        null,
        now,
        now
      );

      expect(dl.id.value).toBe(id.value);
      expect(dl.companyId.value).toBe(companyId.value);
      expect(dl.customerId.value).toBe(CUSTOMER_ID.value);
    });
  });

  describe("changeName", () => {
    it("名前を変更できる", () => {
      const dl = createTestDeliveryLocation();

      dl.changeName(new CompanyName("新しい納品先名"));

      expect(dl.name.value).toBe("新しい納品先名");
    });
  });

  describe("changeAddress", () => {
    it("住所を変更できる", () => {
      const dl = createTestDeliveryLocation();

      dl.changeAddress(
        new PostalCode("9876543"),
        new Prefecture("大阪府"),
        new Address("中央区4-5-6")
      );

      expect(dl.postalCode?.value).toBe("9876543");
      expect(dl.prefecture?.value).toBe("大阪府");
      expect(dl.address?.value).toBe("中央区4-5-6");
    });
  });

  describe("changeDeliveryNotes", () => {
    it("配送備考を変更できる", () => {
      const dl = createTestDeliveryLocation();

      dl.changeDeliveryNotes(new DeliveryNotes("土日不可"));

      expect(dl.deliveryNotes?.value).toBe("土日不可");
    });

    it("配送備考をnullにクリアできる", () => {
      const dl = DeliveryLocation.create(
        new CompanyCode("DL001"),
        new CompanyName("テスト"),
        CUSTOMER_ID,
        { deliveryNotes: new DeliveryNotes("メモ") }
      );

      dl.changeDeliveryNotes(null);

      expect(dl.deliveryNotes).toBeNull();
    });
  });

  describe("activate / deactivate", () => {
    it("無効化できる", () => {
      const dl = createTestDeliveryLocation();

      dl.deactivate();

      expect(dl.isActive).toBe(false);
    });

    it("有効化できる", () => {
      const dl = createTestDeliveryLocation();
      dl.deactivate();

      dl.activate();

      expect(dl.isActive).toBe(true);
    });
  });
});
