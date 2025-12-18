import { getRequiredSession, isAdmin, isOwner } from "@server/shared/auth";
import { GetEmployeeByEmployeeCdQuery } from "@subdomains/employee/application/queries/GetEmployeeByEmployeeCdQuery";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { notFound } from "next/navigation";
import { EmployeeDeleteForm } from "./EmployeeDeleteForm";
import { EmployeeUpdateForm } from "./EmployeeUpdateForm";

export default async function Page({
  params,
}: {
  params: Promise<{ employeeCd: string }>;
}) {
  const { employeeCd } = await params;

  const session = await getRequiredSession();

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

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">従業員管理</h1>

      {/* 更新フォーム（Client Component） */}
      <EmployeeUpdateForm employee={employee} canUpdate={canUpdate} />

      {/* 削除フォーム（Client Component） */}
      {canDelete && <EmployeeDeleteForm employeeId={employee.id} />}
    </div>
  );
}
