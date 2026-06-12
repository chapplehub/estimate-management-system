import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";

export type CustomerCreateOptions = {
  postalCode?: PostalCode;
  prefecture?: Prefecture;
  address?: Address;
  phoneNumber?: PhoneNumber;
  faxNumber?: FaxNumber;
  contactPerson?: string;
  marginRate?: MarginRate;
};

/**
 * 得意先エンティティ
 *
 * 取引先共通属性（コード・名称・住所・連絡先・有効フラグ）を自テーブルに持つ集約ルート（ADR-0043）。
 * 得意先固有の属性として標準マージン率を持つ。
 */
export class Customer {
  static readonly ENTITY_NAME = "得意先";

  private constructor(
    private readonly _id: CustomerId,
    private readonly _code: CompanyCode,
    private _name: CompanyName,
    private _postalCode: PostalCode | null,
    private _prefecture: Prefecture | null,
    private _address: Address | null,
    private _phoneNumber: PhoneNumber | null,
    private _faxNumber: FaxNumber | null,
    private _contactPerson: string | null,
    private _isActive: boolean,
    private _marginRate: MarginRate | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規得意先を作成
   */
  static create(code: CompanyCode, name: CompanyName, options?: CustomerCreateOptions): Customer {
    const now = new Date();

    return new Customer(
      CustomerId.generate(),
      code,
      name,
      options?.postalCode ?? null,
      options?.prefecture ?? null,
      options?.address ?? null,
      options?.phoneNumber ?? null,
      options?.faxNumber ?? null,
      options?.contactPerson ?? null,
      true,
      options?.marginRate ?? null,
      now,
      now
    );
  }

  /**
   * DBから得意先を再構築
   */
  static reconstruct(
    id: CustomerId,
    code: CompanyCode,
    name: CompanyName,
    postalCode: PostalCode | null,
    prefecture: Prefecture | null,
    address: Address | null,
    phoneNumber: PhoneNumber | null,
    faxNumber: FaxNumber | null,
    contactPerson: string | null,
    isActive: boolean,
    marginRate: MarginRate | null,
    createdAt: Date,
    updatedAt: Date
  ): Customer {
    return new Customer(
      id,
      code,
      name,
      postalCode,
      prefecture,
      address,
      phoneNumber,
      faxNumber,
      contactPerson,
      isActive,
      marginRate,
      createdAt,
      updatedAt
    );
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  changeName(newName: CompanyName): void {
    this._name = newName;
    this._updatedAt = new Date();
  }

  changeAddress(
    postalCode: PostalCode | null,
    prefecture: Prefecture | null,
    address: Address | null
  ): void {
    this._postalCode = postalCode;
    this._prefecture = prefecture;
    this._address = address;
    this._updatedAt = new Date();
  }

  changeContactInfo(
    phoneNumber: PhoneNumber | null,
    faxNumber: FaxNumber | null,
    contactPerson: string | null
  ): void {
    this._phoneNumber = phoneNumber;
    this._faxNumber = faxNumber;
    this._contactPerson = contactPerson;
    this._updatedAt = new Date();
  }

  changeMarginRate(newRate: MarginRate | null): void {
    this._marginRate = newRate;
    this._updatedAt = new Date();
  }

  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): CustomerId {
    return this._id;
  }

  get code(): CompanyCode {
    return this._code;
  }

  get name(): CompanyName {
    return this._name;
  }

  get postalCode(): PostalCode | null {
    return this._postalCode;
  }

  get prefecture(): Prefecture | null {
    return this._prefecture;
  }

  get address(): Address | null {
    return this._address;
  }

  get phoneNumber(): PhoneNumber | null {
    return this._phoneNumber;
  }

  get faxNumber(): FaxNumber | null {
    return this._faxNumber;
  }

  get contactPerson(): string | null {
    return this._contactPerson;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get marginRate(): MarginRate | null {
    return this._marginRate;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
