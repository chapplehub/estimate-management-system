import { verifySession } from "@/app/_lib/verifyAuthentication";
import { getActiveDepartmentsQueryFactory } from "@subdomains/department/application/factories/departmentQueryFactory";
import { getEmployeeByIdQueryFactory } from "@subdomains/employee/application/factories/employeeQueryFactory";
import { resolveEffectiveTaxRateQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { fromDateInputValue, toDateInputValue } from "../_shared/date";
import { CreateEstimateForm } from "./CreateEstimateForm";

/**
 * 見積新規作成画面 S1（C1）。
 *
 * RSC（本ファイル）が作成者（認証セッションの employeeId から解決）・有効部署一覧・既定日付の
 * 有効税率を取得し、クライアントアイランド CreateEstimateForm へ渡す。作成者の従業員情報が
 * 引けない場合は作成不可とし、フォームを出さずに案内する（createdBy 必須・null は作成不可）。
 */
export default async function NewEstimatePage() {
  const session = await verifySession();

  const employeeId = session.user.employeeId;
  const creator = employeeId
    ? await getEmployeeByIdQueryFactory().execute({ id: employeeId })
    : null;

  if (!creator) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">見積新規作成</h1>
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"
          role="alert"
        >
          作成者の従業員情報が取得できないため、見積を作成できません。管理者にお問い合わせください。
        </div>
      </div>
    );
  }

  // 有効部署のみ（GetActiveDepartmentsQuery・Q6）。部署の自動解決は後続 #374。
  const departments = await getActiveDepartmentsQueryFactory().execute({});

  // 既定の見積年月日・締切日は今日（JST）。既定日付の有効税率を read-only 表示の初期値とする。
  const today = toDateInputValue(new Date());
  const initialTaxRate = await resolveEffectiveTaxRateQueryFactory().execute({
    date: fromDateInputValue(today),
  });

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">見積新規作成</h1>
      <CreateEstimateForm
        creatorName={creator.name}
        creatorCode={creator.employeeCd}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        defaultEstimateDate={today}
        defaultDeadline={today}
        initialTaxRate={initialTaxRate}
      />
    </div>
  );
}
