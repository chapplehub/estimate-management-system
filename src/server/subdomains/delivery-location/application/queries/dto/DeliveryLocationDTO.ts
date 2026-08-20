/**
 * 納品先データ転送オブジェクト
 */
export type DeliveryLocationDTO = {
  id: string;
  code: string;
  name: string;
  postalCode: string | null;
  prefecture: string | null;
  address: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  contactPerson: string | null;
  isActive: boolean;
  customerId: string;
  customerName: string;
  customerCode: string;
  deliveryNotes: string | null;
  /** 楽観ロックトークン（ADR-0039）。編集・状態変更フォームで往復させる。 */
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
