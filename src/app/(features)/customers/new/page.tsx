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

      <h1 className="text-3xl font-bold mb-8">得意先登録</h1>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">取引先情報</h2>
        <CustomerCreateForm />
      </div>
    </div>
  );
}
