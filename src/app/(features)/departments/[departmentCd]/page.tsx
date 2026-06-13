import { verifySession } from "@/app/_lib/verifyAuthentication";
import { DepartmentSelectField } from "@/app/_components/form";
import { isAdmin } from "@server/shared/auth";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { notFound } from "next/navigation";
import { DepartmentDeleteForm } from "./DepartmentDeleteForm";
import { DepartmentUpdateForm } from "./DepartmentUpdateForm";

export default async function Page({ params }: { params: Promise<{ departmentCd: string }> }) {
  const { departmentCd } = await params;

  const session = await verifySession();

  // データ取得
  const queryService = new PrismaDepartmentQueryService();
  const department = await queryService.findByDepartmentCd(departmentCd);
  if (!department) {
    notFound();
  }

  // 権限判定
  const canUpdate = isAdmin(session);
  const canDelete = isAdmin(session);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">部署管理</h1>

      {/* 更新フォーム（Client Component） */}
      <DepartmentUpdateForm
        department={department}
        canUpdate={canUpdate}
        parentDepartmentSelectSlot={
          <DepartmentSelectField
            name="parentId"
            id="parentId"
            defaultValue={department.parentId ?? undefined}
            disabled={!canUpdate}
            excludeIds={[department.id]}
          />
        }
      />

      {/* 削除フォーム（Client Component） */}
      {canDelete && (
        <DepartmentDeleteForm departmentId={department.id} version={department.version} />
      )}
    </div>
  );
}
