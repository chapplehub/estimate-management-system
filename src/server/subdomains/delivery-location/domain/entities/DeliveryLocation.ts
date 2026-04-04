import { generateId } from "@server/shared/generateId";
import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";

export type DeliveryLocationCreateOptions = {
  postalCode?: PostalCode;
  prefecture?: Prefecture;
  address?: Address;
  phoneNumber?: PhoneNumber;
  faxNumber?: FaxNumber;
  contactPerson?: string;
  deliveryNotes?: DeliveryNotes;
};

/**
 * 納品先エンティティ
 *
 * Company（取引先基底）の情報を埋め込んだ集約ルート。
 * 必ず1つの得意先（Customer）に紐づく。
 */
export class DeliveryLocation {
  static readonly ENTITY_NAME = "納品先";

  private constructor(
    private readonly _id: string,
    private readonly _companyId: string,
    private readonly _code: CompanyCode,
    private _name: CompanyName,
    private _postalCode: PostalCode | null,
    private _prefecture: Prefecture | null,
    private _address: Address | null,
    private _phoneNumber: PhoneNumber | null,
    private _faxNumber: FaxNumber | null,
    private _contactPerson: string | null,
    private _isActive: boolean,
    private readonly _customerId: string,
    private _deliveryNotes: DeliveryNotes | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規納品先を作成
   *
   * @param code 取引先コード
   * @param name 名称
   * @param customerId 親得意先ID（不変）
   * @param options オプション属性
   */
  static create(
    code: CompanyCode,
    name: CompanyName,
    customerId: string,
    options?: DeliveryLocationCreateOptions
  ): DeliveryLocation {
    const now = new Date();

    return new DeliveryLocation(
      generateId(),
      generateId(),
      code,
      name,
      options?.postalCode ?? null,
      options?.prefecture ?? null,
      options?.address ?? null,
      options?.phoneNumber ?? null,
      options?.faxNumber ?? null,
      options?.contactPerson ?? null,
      true,
      customerId,
      options?.deliveryNotes ?? null,
      now,
      now
    );
  }

  /**
   * DBから納品先を再構築
   */
  static reconstruct(
    id: string,
    companyId: string,
    code: CompanyCode,
    name: CompanyName,
    postalCode: PostalCode | null,
    prefecture: Prefecture | null,
    address: Address | null,
    phoneNumber: PhoneNumber | null,
    faxNumber: FaxNumber | null,
    contactPerson: string | null,
    isActive: boolean,
    customerId: string,
    deliveryNotes: DeliveryNotes | null,
    createdAt: Date,
    updatedAt: Date
  ): DeliveryLocation {
    return new DeliveryLocation(
      id,
      companyId,
      code,
      name,
      postalCode,
      prefecture,
      address,
      phoneNumber,
      faxNumber,
      contactPerson,
      isActive,
      customerId,
      deliveryNotes,
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

  changeDeliveryNotes(newNotes: DeliveryNotes | null): void {
    this._deliveryNotes = newNotes;
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

  get id(): string {
    return this._id;
  }

  get companyId(): string {
    return this._companyId;
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

  get customerId(): string {
    return this._customerId;
  }

  get deliveryNotes(): DeliveryNotes | null {
    return this._deliveryNotes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
