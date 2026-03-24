/**
 * 得意先データ転送オブジェクト
 */
export type CustomerDTO = {
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
  marginRate: number | null;
  createdAt: Date;
  updatedAt: Date;
};
