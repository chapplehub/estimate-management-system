import Link from "next/link";
import { ProductCreateForm } from "./ProductCreateForm";

export default function ProductNewPage() {
  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/products" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 商品一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">新規商品登録</h1>

      <ProductCreateForm />

      <div className="mt-4">
        <Link
          href="/products"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
