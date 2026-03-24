import { describe, expect, it } from "vitest";
import { Customer } from "../Customer";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { Address } from "@server/shared/domain/values/Address";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";

describe("Customer Entity", () => {
  const createTestCustomer = () =>
    Customer.create(new CompanyCode("CUST001"), new CompanyName("株式会社テスト"), {
      marginRate: new MarginRate(10),
    });

  describe("create", () => {
    it("必須項目のみで得意先を作成できる", () => {
      const customer = Customer.create(
        new CompanyCode("CUST001"),
        new CompanyName("株式会社テスト")
      );

      expect(customer.id).toBeTruthy();
      expect(customer.companyId).toBeTruthy();
      expect(customer.id).not.toBe(customer.companyId);
      expect(customer.code.value).toBe("CUST001");
      expect(customer.name.value).toBe("株式会社テスト");
      expect(customer.isActive).toBe(true);
      expect(customer.marginRate).toBeNull();
      expect(customer.postalCode).toBeNull();
    });

    it("全オプションを指定して得意先を作成できる", () => {
      const customer = Customer.create(new CompanyCode("CUST002"), new CompanyName("テスト商事"), {
        postalCode: new PostalCode("1234567"),
        prefecture: new Prefecture("東京都"),
        address: new Address("渋谷区1-2-3"),
        phoneNumber: new PhoneNumber("0312345678"),
        faxNumber: new FaxNumber("0312345679"),
        contactPerson: "田中太郎",
        marginRate: new MarginRate(15.5),
      });

      expect(customer.postalCode?.value).toBe("1234567");
      expect(customer.prefecture?.value).toBe("東京都");
      expect(customer.address?.value).toBe("渋谷区1-2-3");
      expect(customer.phoneNumber?.value).toBe("0312345678");
      expect(customer.faxNumber?.value).toBe("0312345679");
      expect(customer.contactPerson).toBe("田中太郎");
      expect(customer.marginRate?.value).toBe(15.5);
    });
  });

  describe("reconstruct", () => {
    it("DBからの再構築が正しく動作する", () => {
      const now = new Date();
      const customer = Customer.reconstruct(
        "test-id",
        "test-company-id",
        new CompanyCode("CUST001"),
        new CompanyName("株式会社テスト"),
        null,
        null,
        null,
        null,
        null,
        null,
        true,
        new MarginRate(10),
        now,
        now
      );

      expect(customer.id).toBe("test-id");
      expect(customer.companyId).toBe("test-company-id");
      expect(customer.createdAt).toBe(now);
    });
  });

  describe("changeName", () => {
    it("名前を変更できる", () => {
      const customer = createTestCustomer();

      customer.changeName(new CompanyName("新しい会社名"));

      expect(customer.name.value).toBe("新しい会社名");
    });
  });

  describe("changeAddress", () => {
    it("住所を変更できる", () => {
      const customer = createTestCustomer();

      customer.changeAddress(
        new PostalCode("9876543"),
        new Prefecture("大阪府"),
        new Address("中央区4-5-6")
      );

      expect(customer.postalCode?.value).toBe("9876543");
      expect(customer.prefecture?.value).toBe("大阪府");
      expect(customer.address?.value).toBe("中央区4-5-6");
    });

    it("住所をnullにクリアできる", () => {
      const customer = Customer.create(new CompanyCode("CUST001"), new CompanyName("テスト"), {
        postalCode: new PostalCode("1234567"),
      });

      customer.changeAddress(null, null, null);

      expect(customer.postalCode).toBeNull();
      expect(customer.prefecture).toBeNull();
      expect(customer.address).toBeNull();
    });
  });

  describe("changeContactInfo", () => {
    it("連絡先を変更できる", () => {
      const customer = createTestCustomer();

      customer.changeContactInfo(
        new PhoneNumber("0612345678"),
        new FaxNumber("0612345679"),
        "佐藤花子"
      );

      expect(customer.phoneNumber?.value).toBe("0612345678");
      expect(customer.faxNumber?.value).toBe("0612345679");
      expect(customer.contactPerson).toBe("佐藤花子");
    });
  });

  describe("changeMarginRate", () => {
    it("マージン率を変更できる", () => {
      const customer = createTestCustomer();

      customer.changeMarginRate(new MarginRate(20));

      expect(customer.marginRate?.value).toBe(20);
    });

    it("マージン率をnullにクリアできる", () => {
      const customer = createTestCustomer();

      customer.changeMarginRate(null);

      expect(customer.marginRate).toBeNull();
    });
  });

  describe("activate / deactivate", () => {
    it("無効化できる", () => {
      const customer = createTestCustomer();

      customer.deactivate();

      expect(customer.isActive).toBe(false);
    });

    it("有効化できる", () => {
      const customer = createTestCustomer();
      customer.deactivate();

      customer.activate();

      expect(customer.isActive).toBe(true);
    });
  });
});
