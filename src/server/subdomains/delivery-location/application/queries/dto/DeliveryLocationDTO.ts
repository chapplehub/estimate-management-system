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
  createdAt: Date;
  updatedAt: Date;
};
