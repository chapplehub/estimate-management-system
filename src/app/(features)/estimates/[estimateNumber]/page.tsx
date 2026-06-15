import { verifySession } from "@/app/_lib/verifyAuthentication";
import { getActiveDepartmentsQueryFactory } from "@subdomains/department/application/factories/departmentQueryFactory";
import { getEstimateDetailQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { notFound } from "next/navigation";
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

  // 部署プルダウン（編集フォーム用）。有効な部署のみ（GetActiveDepartmentsQuery・Q6）。
  const departments = await getActiveDepartmentsQueryFactory().execute({});

  return (
    <div className="container mx-auto p-8">
      {/* ②③ ヘッダー（閲覧⇄編集トグル・S3） */}
      <EstimateHeaderSection
        estimate={estimate}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />

      {/* ④〜⑨ バリエーション（タブ・明細・値引・メモ・金額サマリー） */}
      <VariationPanel variations={estimate.variations} />
    </div>
  );
}
