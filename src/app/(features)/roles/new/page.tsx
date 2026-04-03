import Link from "next/link";
import { getAllPositionsQueryFactory } from "@subdomains/position/application/factories";
import { getAllRolesQueryFactory } from "@subdomains/role/application/factories";
import { RoleCreateForm } from "./RoleCreateForm";

export default async function RoleNewPage() {
  // 全役職・全役割を取得（動的フィルタリング用）
  const [positions, allRoles] = await Promise.all([
    getAllPositionsQueryFactory().execute(),
    getAllRolesQueryFactory().execute({}),
  ]);

  // Client Componentに渡す軽量なオブジェクトに変換（Date除去）
  const positionOptions = positions.map((p) => ({
    id: p.id,
    name: p.name,
    superiorPositionId: p.superiorPositionId,
  }));

  const roleOptions = allRoles.map((r) => ({
    id: r.id,
    name: r.name,
    positionId: r.positionId,
  }));

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Link href="/roles" className="text-blue-600 hover:text-blue-800 hover:underline">
          ← 役割一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">新規役割登録</h1>

      <RoleCreateForm positions={positionOptions} allRoles={roleOptions} />

      <div className="mt-4">
        <Link
          href="/roles"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline inline-block"
        >
          キャンセル
        </Link>
      </div>
    </div>
  );
}
