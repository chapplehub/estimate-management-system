import { verifySession } from "@/app/_lib/verifyAuthentication";
import { DepartmentSelectField } from "@/app/_components/form";
import { isAdmin, isOwner } from "@server/shared/auth";
import { GetEmployeeByEmployeeCdQuery } from "@subdomains/employee/application/queries/GetEmployeeByEmployeeCdQuery";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { notFound } from "next/navigation";
import { filterKachouTierRoleOptions } from "../_shared/superiorRoleOptions";
import { EmployeeDeleteForm } from "./EmployeeDeleteForm";
import { EmployeeUpdateForm } from "./EmployeeUpdateForm";

export default async function Page({ params }: { params: Promise<{ employeeCd: string }> }) {
  const { employeeCd } = await params;

  const session = await verifySession();

  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getEmployeeQuery = new GetEmployeeByEmployeeCdQuery(queryService);
  const employee = await getEmployeeQuery.execute({ employeeCd: employeeCd });
  if (!employee) {
    notFound();
  }

  // 権限判定
  const canUpdate = isAdmin(session) || isOwner(session, employee.id);
  const canDelete = isAdmin(session);

  // 担当役割の選択肢供給（A2・roleCd 昇順）、上位役割候補の葉ティア絞り込み用の役職一覧、
  // 承認者不在ワーニング用の唯一メンバー判定（#565 isSoleMember）は互いに独立した読み取り
  // クエリなので並列に発行する。担当役割なし（assignedRoleId==null）なら isSoleMember はクエリせず false。
  const roleQueryService = new PrismaRoleQueryService();
  const positionQueryService = new PrismaPositionQueryService();
  const [roles, positions, isSoleMemberOfCurrentRole] = await Promise.all([
    roleQueryService.findAll({
      orderBy: { field: "roleCd", direction: "asc" },
    }),
    positionQueryService.findAll(),
    employee.assignedRoleId
      ? roleQueryService.isSoleMember(employee.assignedRoleId, employee.id)
      : Promise.resolve(false),
  ]);
  const roleOptions = roles.map((role) => ({ id: role.id, name: role.name }));
  // 上位役割候補は課長級（役職階層の葉）のみに絞る（ADR-20260707-k4e）
  const superiorRoleOptions = filterKachouTierRoleOptions(roles, positions);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">従業員管理</h1>

      {/* 更新フォーム（Client Component） */}
      <EmployeeUpdateForm
        employee={employee}
        canUpdate={canUpdate}
        roleOptions={roleOptions}
        superiorRoleOptions={superiorRoleOptions}
        isSoleMemberOfCurrentRole={isSoleMemberOfCurrentRole}
        departmentSelectSlot={
          <DepartmentSelectField
            name="departmentId"
            id="departmentId"
            defaultValue={employee.departmentId}
            disabled={!canUpdate}
          />
        }
      />

      {/* 削除フォーム（Client Component） */}
      {canDelete && <EmployeeDeleteForm employeeId={employee.id} />}
    </div>
  );
}
