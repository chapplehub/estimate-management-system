import { verifyAdmin } from "@/app/_lib/verifyAuthentication";
import { getProductByCodeQueryFactory } from "@subdomains/product/application/factories/productQueryFactory";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductEditForm } from "./ProductEditForm";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ productCd: string }>;
}) {
  const { productCd } = await params;
  // 一般ユーザーは商品詳細へ戻す（サインインへは送らない）。既定の遷移先を上書きしている
  await verifyAdmin(`/products/${productCd}`);

  const query = getProductByCodeQueryFactory();
  const product = await query.execute({ code: productCd });
  if (!product) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link
          href={`/products/${product.code}`}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← 商品詳細に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">商品管理</h1>

      <ProductEditForm product={product} />

      <div className="mt-4">
        <Link
          href={`/products/${product.code}`}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
