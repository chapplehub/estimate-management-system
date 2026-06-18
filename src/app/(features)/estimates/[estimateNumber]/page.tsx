import { verifySession } from "@/app/_lib/verifyAuthentication";
import { getActiveDepartmentsQueryFactory } from "@subdomains/department/application/factories/departmentQueryFactory";
import {
  getEstimateDetailQueryFactory,
  resolveEffectiveTaxRateQueryFactory,
} from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { notFound } from "next/navigation";
import { fromDateInputValue, toDateInputValue } from "../_shared/date";
import { DuplicateEstimateModal } from "./DuplicateEstimateModal";
import { EstimateHeaderSection } from "./EstimateHeaderSection";
import { VariationPanel } from "./VariationPanel";

/**
 * 見積詳細画面 S2 閲覧 / S3 ヘッダー編集。
 *
 * RSC（本ファイル・薄い）が見積詳細 DTO と部署一覧を取得し、②③ ヘッダー領域を
 * クライアントアイランド EstimateHeaderSection（閲覧⇄編集トグル・C2 配線）へ渡す。
 * ④〜⑨ は従来どおり VariationPanel（RSC）へ委譲する。
 */
export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}) {
  const { estimateNumber } = await params;
  await verifySession();

  const estimate = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!estimate) {
    notFound();
  }

  // 複製モーダルの既定日付は今日（JST・新規見積のため）。
  const today = toDateInputValue(new Date());
  // 部署プルダウン（編集フォーム・複製モーダル用・有効な部署のみ Q6）と既定日付の有効税率
  // （複製モーダルの read-only 初期値）は互いに独立なため並列解決する（詳細はホットパスで
  // 逐次 I/O を避ける）。
  const [departments, initialTaxRate] = await Promise.all([
    getActiveDepartmentsQueryFactory().execute({}),
    resolveEffectiveTaxRateQueryFactory().execute({ date: fromDateInputValue(today) }),
  ]);
  const departmentOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="container mx-auto p-8">
      {/* ②③ ヘッダー（閲覧⇄編集トグル・S3）。操作エリアに見積複製モーダル（C6・ADR-0057）を差す。 */}
      <EstimateHeaderSection
        estimate={estimate}
        departments={departmentOptions}
        headerActions={
          <DuplicateEstimateModal
            sourceEstimateNumber={estimate.estimateNumber}
            variations={estimate.variations}
            sourceDepartmentId={estimate.departmentId}
            departments={departmentOptions}
            defaultEstimateDate={today}
            defaultDeadline={today}
            initialTaxRate={initialTaxRate}
          />
        }
      />

      {/* ④〜⑨ バリエーション（タブ・明細・値引・メモ・金額サマリー・S4 内容編集） */}
      <VariationPanel
        estimateNumber={estimate.estimateNumber}
        version={estimate.version}
        variations={estimate.variations}
        taxRate={estimate.taxRate}
        taxRoundingType={estimate.taxRoundingType}
      />
    </div>
  );
}
