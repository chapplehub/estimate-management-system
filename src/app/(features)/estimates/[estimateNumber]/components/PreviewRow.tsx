import { formatYen } from "../../_shared/labels";

/**
 * 金額プレビューの1行（ラベル＋整形済み金額）。バリエーション作成（C3）/編集（C4）フォームの
 * 概算金額プレビューで共有する純粋な表示コンポーネント。確定金額はドメインが唯一の真実（ADR-0033）で、
 * ここでは簡易ライブプレビューのみを描画する。
 */
export function PreviewRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={[
        "flex justify-between py-1",
        emphasize ? "border-t pt-2 text-lg font-bold text-gray-900" : "text-gray-700",
      ].join(" ")}
    >
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  );
}
