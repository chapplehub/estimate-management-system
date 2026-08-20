import { notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/verifyAuthentication";
import { getEstimateApplicationDetailQueryFactory } from "@subdomains/estimate/application/factories/getEstimateApplicationDetailQueryFactory";
import { ApplicationCard } from "./_components/ApplicationCard";
import { ApplicationDetailSummary } from "./_components/ApplicationDetailSummary";
import { ApplicationOperations } from "./_components/ApplicationOperations";
import { ExemptionRecord } from "./_components/ExemptionRecord";

/**
 * 見積申請詳細画面（/estimate-applications/[estimateNumber]/[variationNumber]・#574）
 *
 * 薄い RSC。バリエーションの自然キー（見積番号＋バリエーション番号）で参照クエリ（#573）を引き、
 * 判別ユニオン DTO を `kind` で出し分けて表示ブロック（要約ヘッダ・申請カード・免除記録）へ渡す。
 *
 * クエリは操作可否合成のため操作者（ログイン社員）を必須とする。本システムに employeeId を持たない
 * 閲覧者はいない前提のため、null は fail-fast で throw する（error 境界へ）。ただし操作 UI（承認・
 * 差戻・取下）は後続 issue のため、本画面では `operations` を描画しない（表示のみ）。
 *
 * NotFound（見積番号なし／バリエーション番号なし／申請も免除も無い）はクエリが null を返すため
 * `notFound()`（既存 estimates 詳細と同一パターン）。バリエーション番号が数値でない URL も同様。
 *
 * 操作 UI（承認・差戻・取下・#575）は要約ヘッダの後に `ApplicationOperations` として描画する。可否は
 * DTO の `operations` 3 フラグに従い、資格の無い閲覧者には 3 フラグが全 false で渡り何も描画されない
 * （純粋な閲覧画面）。最終防衛は BE（役割メンバー検証・本人性検証・楽観ロック）で、FE は UX の出し分け。
 */
export default async function EstimateApplicationDetailPage({
  params,
}: {
  params: Promise<{ estimateNumber: string; variationNumber: string }>;
}) {
  const { estimateNumber, variationNumber } = await params;

  // URL セグメントは常に文字列。厳格な 10 進整数（1 始まりの正の数のみ・先頭ゼロ/符号/小数/16 進/
  // 空白を弾く）かつ int4 範囲内のみ受理し、それ以外は notFound()。範囲外・非正規値を Prisma の
  // `Int`(int4) 列 where に到達させないことで 500 を避ける。業務上の上限（1〜99）はここで二重に
  // 持たず、存在しない番号はクエリの null → notFound() に委ねる（DB/ドメイン制約と乖離させない）。
  const variationNumberValue = Number(variationNumber);
  if (!/^[1-9][0-9]*$/.test(variationNumber) || variationNumberValue > 2_147_483_647) {
    notFound();
  }

  const session = await verifySession();
  const operatorEmployeeId = session.user.employeeId;
  if (operatorEmployeeId === null) {
    // 本システムに従業員未紐付けの閲覧者は存在しない前提。到達したら異常系として fail-fast。
    throw new Error("従業員に紐付かないユーザーは見積申請詳細を参照できません");
  }

  const detail = await getEstimateApplicationDetailQueryFactory().execute({
    estimateNumber,
    variationNumber: variationNumberValue,
    operatorEmployeeId,
  });
  if (detail === null) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">見積申請詳細</h1>

      <ApplicationDetailSummary summary={detail.summary} />

      <ApplicationOperations
        operations={detail.operations}
        variationNumber={detail.summary.variationNumber}
      />

      {detail.kind === "EXEMPTED" ? (
        <ExemptionRecord exemption={detail.exemption} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-700">最新の申請</h2>
            <ApplicationCard application={detail.latest} />
          </section>

          {detail.past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-700">過去の申請履歴</h2>
              {detail.past.map((application) => (
                <ApplicationCard key={application.applicationId} application={application} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
