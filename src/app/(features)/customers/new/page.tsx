import Link from "next/link";
import { CustomerCreateForm } from "./CustomerCreateForm";

export default function CustomerNewPage() {
  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/customers" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 得意先一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">新規得意先登録</h1>

      <CustomerCreateForm />

      <div className="mt-4">
        <Link
          href="/customers"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
