import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { isAdmin } from "@server/shared/auth";
import { toJstCalendarDay } from "@server/shared/domain/values/toJstCalendarDay";
import { commonSellingPricePriceStatusQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import type { CommonSellingPricePriceStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceListItemDTO";
import {
  getProductByCodeQueryFactory,
  getProductReferencesQueryFactory,
} from "@subdomains/product/application/factories/productQueryFactory";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS, UNIT_LABELS } from "../_shared/labels";
import { CommonSellingPriceUnsetBanner } from "./CommonSellingPriceUnsetBanner";
import { DeactivateWithReplacementDialog } from "./DeactivateWithReplacementDialog";
import { ProductDeleteForm } from "./ProductDeleteForm";
import { ProductStatusForms } from "./ProductStatusForms";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productCd: string }>;
}) {
  const { productCd } = await params;
  const session = await verifySession();

  const query = getProductByCodeQueryFactory();
  const product = await query.execute({ code: productCd });
  if (!product) {
    notFound();
  }

  const canEdit = isAdmin(session);

  // 共通販売単価の設定誘導（#487・ソフトなアナウンス）。
  // 有効かつ価格を持ちうる商品（個別/消耗品）に限り、現在有効な単価の三状態を引く。無効商品・セット商品は
  // 誘導対象外なので read すら叩かない（判断2）。参照日はアプリ層で注入（CURRENT_DATE 不使用）。
  let priceStatus: CommonSellingPricePriceStatus | null = null;
  if (product.isActive && ProductCategory.from(product.category).canHavePrice()) {
    priceStatus = await commonSellingPricePriceStatusQueryFactory().find({
      productCode: product.code,
      referenceDate: toJstCalendarDay(new Date()),
    });
  }

  // 有効な商品の場合、参照元を取得（無効化時の入替ダイアログ用）
  let referencingProducts: { code: string; name: string; category: string }[] = [];
  if (canEdit && product.isActive) {
    const referencesQuery = getProductReferencesQueryFactory();
    const refs = await referencesQuery.execute({ id: product.id });
    referencingProducts = refs.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
    }));
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/products" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 商品一覧に戻る
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">商品管理</h1>
        {canEdit && (
          <Link
            href={`/products/${product.code}/edit`}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            編集
          </Link>
        )}
      </div>

      {/* 共通販売単価 未設定/失効の設定誘導バナー（#487） */}
      {priceStatus && (
        <CommonSellingPriceUnsetBanner priceStatus={priceStatus} productCode={product.code} />
      )}

      {/* 基本情報 */}
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">商品詳細</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-bold text-gray-700">商品コード</dt>
            <dd className="mt-1 text-gray-900">{product.code}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">商品名</dt>
            <dd className="mt-1 text-gray-900">{product.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">商品区分</dt>
            <dd className="mt-1">
              <Badge variant="outline">
                {CATEGORY_LABELS[product.category] ?? product.category}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">単位</dt>
            <dd className="mt-1 text-gray-900">{UNIT_LABELS[product.unit] ?? product.unit}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-gray-700">状態</dt>
            <dd className="mt-1">
              <Badge variant={product.isActive ? "default" : "secondary"}>
                {product.isActive ? "有効" : "無効"}
              </Badge>
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-bold text-gray-700">商品説明</dt>
            <dd className="mt-1 text-gray-900 whitespace-pre-wrap">
              {product.description || "なし"}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-bold text-gray-700">備考</dt>
            <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{product.note || "なし"}</dd>
          </div>
        </dl>
      </div>

      {/* 周辺商品（個別商品のみ） */}
      {product.category === "INDIVIDUAL" && (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-500">周辺商品</h2>
            {canEdit && (
              <Link
                href={`/products/${product.code}/relations`}
                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                設定 →
              </Link>
            )}
          </div>
          {product.relatedProducts.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-sm font-bold text-gray-700">商品コード</th>
                  <th className="py-2 text-sm font-bold text-gray-700">商品名</th>
                  <th className="py-2 text-sm font-bold text-gray-700">区分</th>
                  <th className="py-2 text-sm font-bold text-gray-700 text-right">数量</th>
                </tr>
              </thead>
              <tbody>
                {product.relatedProducts.map((rel) => (
                  <tr key={rel.relatedProductId} className="border-b">
                    <td className="py-2">
                      <Link
                        href={`/products/${rel.relatedProductCode}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {rel.relatedProductCode}
                      </Link>
                    </td>
                    <td className="py-2">{rel.relatedProductName}</td>
                    <td className="py-2">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[rel.relatedProductCategory] ?? rel.relatedProductCategory}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{rel.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">周辺商品が設定されていません</p>
          )}
        </div>
      )}

      {/* セット構成（セット商品のみ） */}
      {product.category === "SET" && (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-500">セット構成</h2>
            {canEdit && (
              <Link
                href={`/products/${product.code}/components`}
                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                設定 →
              </Link>
            )}
          </div>
          {product.setComponents.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-sm font-bold text-gray-700">商品コード</th>
                  <th className="py-2 text-sm font-bold text-gray-700">商品名</th>
                  <th className="py-2 text-sm font-bold text-gray-700">区分</th>
                  <th className="py-2 text-sm font-bold text-gray-700 text-right">数量</th>
                </tr>
              </thead>
              <tbody>
                {product.setComponents.map((comp) => (
                  <tr key={comp.componentProductId} className="border-b">
                    <td className="py-2">
                      <Link
                        href={`/products/${comp.componentProductCode}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {comp.componentProductCode}
                      </Link>
                    </td>
                    <td className="py-2">{comp.componentProductName}</td>
                    <td className="py-2">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[comp.componentProductCategory] ??
                          comp.componentProductCategory}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{comp.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">セット構成が設定されていません</p>
          )}
        </div>
      )}

      {/* アクションボタン（管理者のみ） */}
      {canEdit && (
        <div className="flex gap-4 items-start">
          {product.isActive && referencingProducts.length > 0 ? (
            <DeactivateWithReplacementDialog
              productId={product.id}
              productCd={product.code}
              referencingProducts={referencingProducts}
              version={product.version}
            />
          ) : (
            <ProductStatusForms
              productId={product.id}
              productCd={product.code}
              isActive={product.isActive}
              version={product.version}
            />
          )}
          <ProductDeleteForm productId={product.id} version={product.version} />
        </div>
      )}
    </div>
  );
}
