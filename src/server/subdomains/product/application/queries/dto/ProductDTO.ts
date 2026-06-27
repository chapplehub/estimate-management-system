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
  relatedProducts: ProductRelationDTO[];
  setComponents: SetProductComponentDTO[];
  /** 楽観ロックトークン。編集画面からフォームで往復させる（ADR-0039） */
  version: number;
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
