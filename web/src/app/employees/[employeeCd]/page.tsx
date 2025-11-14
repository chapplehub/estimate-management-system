import { PrismaEmployeeQueryService } from "@/subdomains/employee/infra/queries/PrismaEmployeeQueryService";
import { GetEmployeeByEmployeeCdQuery } from "@/subdomains/employee/queries/GetEmployeeByEmployeeCdQuery";
import { notFound } from "next/navigation";
import { EmployeeUpdateForm } from "./EmployeeUpdateForm";
import { EmployeeDeleteForm } from "./EmployeeDeleteForm";

export default async function Page({
  params,
}: {
  params: Promise<{ employeeCd: string }>;
}) {
  const { employeeCd } = await params;

  // データ取得（Query側）
  const queryService = new PrismaEmployeeQueryService();
  const getEmployeeQuery = new GetEmployeeByEmployeeCdQuery(queryService);
  const employee = await getEmployeeQuery.execute({ employeeCd: employeeCd });
  if (!employee) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">従業員管理</h1>

      {/* 更新フォーム（Client Component） */}
      <EmployeeUpdateForm employee={employee} />

      {/* 削除フォーム（Client Component） */}
      <EmployeeDeleteForm employeeId={employee.id} />
    </div>
  );
}
