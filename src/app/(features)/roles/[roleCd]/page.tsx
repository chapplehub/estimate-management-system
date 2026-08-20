import { verifySession } from "@/app/_lib/verifyAuthentication";
import { isAdmin } from "@server/shared/auth";
import { getRolesByPositionQueryFactory } from "@subdomains/role/application/factories";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { getAllPositionsQueryFactory } from "@subdomains/position/application/factories";
import { notFound } from "next/navigation";
import { RoleDeleteForm } from "./RoleDeleteForm";
import { RoleUpdateForm } from "./RoleUpdateForm";

export default async function Page({ params }: { params: Promise<{ roleCd: string }> }) {
  const { roleCd } = await params;

  const session = await verifySession();

  // データ取得
  const queryService = new PrismaRoleQueryService();
  const role = await queryService.findByRoleCd(roleCd);
  if (!role) {
    notFound();
  }

  // 全役職を取得して、当該役割の上位役職IDを特定
  const positions = await getAllPositionsQueryFactory().execute();
  const currentPosition = positions.find((p) => p.id === role.positionId);
  const superiorPositionId = currentPosition?.superiorPositionId ?? null;

  // 上位役割候補を取得（上位役職がある場合のみ）
  let superiorRoleOptions: { id: string; name: string }[] = [];
  if (superiorPositionId) {
    const getRolesByPositionQuery = getRolesByPositionQueryFactory();
    const superiorRoles = await getRolesByPositionQuery.execute({
      positionId: superiorPositionId,
    });
    superiorRoleOptions = superiorRoles.map((r) => ({ id: r.id, name: r.name }));
  }

  // 権限判定
  const canUpdate = isAdmin(session);
  const canDelete = isAdmin(session);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">役割管理</h1>

      {/* 更新フォーム（Client Component） */}
      <RoleUpdateForm
        role={{
          id: role.id,
          roleCd: role.roleCd,
          name: role.name,
          positionName: role.positionName,
          superiorRoleId: role.superiorRoleId,
          version: role.version,
        }}
        canUpdate={canUpdate}
        superiorRoleOptions={superiorRoleOptions}
      />

      {/* 削除フォーム（Client Component） */}
      {canDelete && <RoleDeleteForm roleId={role.id} version={role.version} />}
    </div>
  );
}
