/**
 * 商品データ転送オブジェクト
 */
export type ProductDTO = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  isActive: boolean;
  description: string | null;
  note: string | null;
  costPrice: number | null;
  relatedProducts: ProductRelationDTO[];
  setComponents: SetProductComponentDTO[];
  createdAt: Date;
  updatedAt: Date;
};

export type ProductRelationDTO = {
  relatedProductId: string;
  relatedProductCode: string;
  relatedProductName: string;
  relatedProductCategory: string;
  quantity: number;
};

export type SetProductComponentDTO = {
  componentProductId: string;
  componentProductCode: string;
  componentProductName: string;
  componentProductCategory: string;
  quantity: number;
};
