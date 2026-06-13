import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductRepository } from "@subdomains/product/domain/repositories/ProductRepository";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductMapper } from "../mappers/ProductMapper";

/** relations/components を include するための共通オプション */
const INCLUDE_RELATIONS = {
  relatedProducts: {
    include: { relatedProduct: true },
  },
  setComponents: {
    include: { componentProduct: true },
  },
} as const;

export class PrismaProductRepository implements ProductRepository {
  async insert(product: Product): Promise<Product> {
    const result = await prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: ProductMapper.toPrismaCreate(product),
      });

      if (product.relatedProducts.length > 0) {
        await tx.productRelation.createMany({
          data: product.relatedProducts.map((r) => ({
            productId: product.id.value,
            relatedProductId: r.relatedProductId.value,
            quantity: r.quantity.value,
          })),
        });
      }

      if (product.components.length > 0) {
        await tx.setProductComponent.createMany({
          data: product.components.map((c) => ({
            setProductId: product.id.value,
            componentProductId: c.componentProductId.value,
            quantity: c.quantity.value,
          })),
        });
      }

      return await tx.product.findUniqueOrThrow({
        where: { id: product.id.value },
        include: INCLUDE_RELATIONS,
      });
    });

    return ProductMapper.toDomain(result);
  }

  async update(product: Product, expectedVersion: number): Promise<Product> {
    const result = await prisma.$transaction(async (tx) => {
      // 楽観ロック: 条件付き UPDATE をトランザクション先頭で実行（ADR-0039）
      const rootUpdate = await tx.product.updateMany({
        where: { id: product.id.value, version: expectedVersion },
        data: {
          ...ProductMapper.toPrismaUpdate(product),
          version: { increment: 1 },
        },
      });

      // count = 0 は「version 不一致」と「行の消失」の両方を覆う（ADR-0039 細目5）
      if (rootUpdate.count === 0) {
        throw new ConflictError(
          "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
        );
      }

      // 子テーブルは差分 upsert（全削除 → 再作成）
      await tx.productRelation.deleteMany({
        where: { productId: product.id.value },
      });
      await tx.setProductComponent.deleteMany({
        where: { setProductId: product.id.value },
      });

      if (product.relatedProducts.length > 0) {
        await tx.productRelation.createMany({
          data: product.relatedProducts.map((r) => ({
            productId: product.id.value,
            relatedProductId: r.relatedProductId.value,
            quantity: r.quantity.value,
          })),
        });
      }

      if (product.components.length > 0) {
        await tx.setProductComponent.createMany({
          data: product.components.map((c) => ({
            setProductId: product.id.value,
            componentProductId: c.componentProductId.value,
            quantity: c.quantity.value,
          })),
        });
      }

      return await tx.product.findUniqueOrThrow({
        where: { id: product.id.value },
        include: INCLUDE_RELATIONS,
      });
    });

    return ProductMapper.toDomain(result);
  }

  async save(product: Product): Promise<Product> {
    const result = await prisma.$transaction(async (tx) => {
      // 既存のrelations/componentsを削除
      await tx.productRelation.deleteMany({
        where: { productId: product.id.value },
      });
      await tx.setProductComponent.deleteMany({
        where: { setProductId: product.id.value },
      });

      // Product本体をupsert
      await tx.product.upsert({
        where: { id: product.id.value },
        create: ProductMapper.toPrismaCreate(product),
        update: ProductMapper.toPrismaUpdate(product),
      });

      // relations を再作成
      if (product.relatedProducts.length > 0) {
        await tx.productRelation.createMany({
          data: product.relatedProducts.map((r) => ({
            productId: product.id.value,
            relatedProductId: r.relatedProductId.value,
            quantity: r.quantity.value,
          })),
        });
      }

      // components を再作成
      if (product.components.length > 0) {
        await tx.setProductComponent.createMany({
          data: product.components.map((c) => ({
            setProductId: product.id.value,
            componentProductId: c.componentProductId.value,
            quantity: c.quantity.value,
          })),
        });
      }

      // relations/components を含む完全なProductを再取得
      return await tx.product.findUniqueOrThrow({
        where: { id: product.id.value },
        include: INCLUDE_RELATIONS,
      });
    });

    return ProductMapper.toDomain(result);
  }

  async delete(id: ProductId): Promise<void> {
    await prisma.product.delete({
      where: { id: id.value },
    });
  }

  async findById(id: ProductId): Promise<Product | null> {
    const prismaProduct = await prisma.product.findUnique({
      where: { id: id.value },
      include: INCLUDE_RELATIONS,
    });

    return prismaProduct ? ProductMapper.toDomain(prismaProduct) : null;
  }

  async findByCode(code: ProductCode): Promise<Product | null> {
    const prismaProduct = await prisma.product.findUnique({
      where: { code: code.value },
      include: INCLUDE_RELATIONS,
    });

    return prismaProduct ? ProductMapper.toDomain(prismaProduct) : null;
  }

  async findByName(name: ProductName): Promise<Product | null> {
    const prismaProduct = await prisma.product.findUnique({
      where: { name: name.value },
      include: INCLUDE_RELATIONS,
    });

    return prismaProduct ? ProductMapper.toDomain(prismaProduct) : null;
  }

  /**
   * 見積・受注で使用中かチェック
   * TODO: Estimateモデル実装時に実際のチェックロジックに更新
   */
  async existsInEstimateOrOrder(_id: ProductId): Promise<boolean> {
    return false;
  }

  async findReferencingProducts(id: ProductId): Promise<Product[]> {
    const prismaProducts = await prisma.product.findMany({
      where: {
        OR: [
          { relatedProducts: { some: { relatedProductId: id.value } } },
          { setComponents: { some: { componentProductId: id.value } } },
        ],
      },
      include: INCLUDE_RELATIONS,
    });

    return prismaProducts.map((p) => ProductMapper.toDomain(p));
  }

  async replaceInRelationsAndComponents(
    targetId: ProductId,
    replacementId: ProductId
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 参照元ルートは置換前に特定する（置換後は子行が入れ替え先を指し、条件が変わるため）
      const referencingProducts = await tx.product.findMany({
        where: {
          OR: [
            { relatedProducts: { some: { relatedProductId: targetId.value } } },
            { setComponents: { some: { componentProductId: targetId.value } } },
          ],
        },
        select: { id: true },
      });

      // 周辺商品テーブル内の targetId → replacementId に置換
      await tx.productRelation.updateMany({
        where: { relatedProductId: targetId.value },
        data: { relatedProductId: replacementId.value },
      });

      // セット構成テーブル内の targetId → replacementId に置換
      await tx.setProductComponent.updateMany({
        where: { componentProductId: targetId.value },
        data: { componentProductId: replacementId.value },
      });

      // ルートを経由しない横断一括書き込みのため、影響を受けた参照元の version を
      // 無条件増分する（ADR-0039 細目7）。これを怠ると、参照元の編集フォームを
      // 開いていたユーザーの stale な保存が入れ替え結果を静かに巻き戻す
      await tx.product.updateMany({
        where: { id: { in: referencingProducts.map((p) => p.id) } },
        data: { version: { increment: 1 } },
      });
    });
  }
}
