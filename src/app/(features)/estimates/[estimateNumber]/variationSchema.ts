import { z } from "zod";

/**
 * バリ内容編集フォーム（S4 / C4）のバリデーションスキーマ。
 *
 * 動的な明細配列は単一の hidden field に JSON で載せて往復する（ADR-0050）。本スキーマは
 * その文字列を `transform(JSON.parse).pipe(z.array(...))` で検証する。version・全体値引・
 * メモ等のスカラー項目は FormData の文字列を coerce する（S3 ヘッダー編集と同型）。
 * 数値の最終ガードはドメイン VO（Quantity / DiscountRate / Money）が担う二重防御の外側。
 * sortOrder は「配列順 = 真実」（ADR-0050）のため JSON には載せず Server Action で index 導出。
 */

/** 明細1件（JSON 配列の要素）。商品名・単位は選択時スナップショット（§8・編集不可）。 */
const lineSchema = z.object({
  productId: z.string().min(1, "商品を選択してください"),
  itemName: z.string().min(1, "商品名が空です"),
  unit: z.string().min(1, "単位が空です"),
  // 数量: 1 以上の整数（Quantity VO と整合）。
  quantity: z.number().int("数量は整数で入力してください").min(1, "数量は1以上で入力してください"),
  // 単価: 円・0 以上（販売単価マスタ未確定のため新規行は 0＝要入力）。
  unitPrice: z.number().min(0, "単価は0以上で入力してください"),
  // 掛率: 0 超〜9.9999（DiscountRate VO と整合）。1.0 が値引なし。
  discountRate: z
    .number()
    .gt(0, "掛率は0より大きい値で入力してください")
    .max(9.9999, "掛率は9.9999以下で入力してください"),
  // 明細値引: 円・0 以上。
  itemDiscount: z.number().min(0, "明細値引は0以上で入力してください"),
  // メモは optional: conform の parseWithZod は空フィールドを undefined に変換するため
  // z.string() だと空メモが「expected string, received undefined」で失敗する。空＝未入力＝
  // ドメインの Null Object（ADR-0034）に対応するので optional が正しい。required に戻さないこと。
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
});

export type VariationLineInput = z.infer<typeof lineSchema>;

/**
 * トップレベル明細ノード（往復形状 A・ADR-0047）。通常明細は lineSchema ＋ 判別子 kind="line"。
 */
const lineNodeSchema = lineSchema.extend({ kind: z.literal("line") });

/**
 * セット群ノード（ADR-0047）。構成明細を入れ子の components で持つ。群自身は価格・並び順を持たない。
 * components は `.min(1)` で空群を**第一防御**として弾く（空群禁止はドメインでも担保される二重防御）。
 */
const setGroupNodeSchema = z.object({
  kind: z.literal("setGroup"),
  productId: z.string().min(1, "セット商品を選択してください"),
  itemName: z.string().min(1, "セット商品名が空です"),
  unit: z.string().min(1, "単位が空です"),
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
  components: z.array(lineSchema).min(1, "セットは最低1件の構成明細が必要です"),
});

/** トップレベルノード（通常明細 or セット群）。判別子 kind で分岐する。 */
const nodeSchema = z.discriminatedUnion("kind", [lineNodeSchema, setGroupNodeSchema]);

export type VariationNodeInput = z.infer<typeof nodeSchema>;
export type VariationSetGroupNodeInput = z.infer<typeof setGroupNodeSchema>;

/** ノード配列フィールド: JSON 文字列をパースして判別子 union 配列へ pipe する（ADR-0050）。空配列許可。 */
const nodesField = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "明細データが不正です" });
      return z.NEVER;
    }
  })
  .pipe(z.array(nodeSchema));

/**
 * バリ内容の共通フィールド（C3 追加・C4 更新で共有）。version は集約ルートの楽観ロックトークン
 * （ADR-0039）、明細は判別子 union のノード配列、全体値引・メモはスカラー（S3 ヘッダー編集と同型）。
 * メモは optional（conform は空フィールドを undefined 化するため・lineSchema 同様。required に戻さないこと）。
 * C3/C4 は identity（variationId）か submissionType だけが異なるため、内容形状をここへ集約する。
 */
const variationContentFields = {
  /** 楽観ロックトークン（ADR-0039・集約ルート）。hidden で往復。 */
  version: z.coerce.number().int(),
  overallDiscount: z.coerce.number().min(0, "全体値引は0以上で入力してください"),
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
  nodes: nodesField,
} as const;

/**
 * バリ内容編集スキーマ（C4・S5 セット群対応）。共通フィールドに編集対象 `variationId` を加える。
 */
export const updateVariationContentNodeSchema = z.object({
  ...variationContentFields,
  /** 編集対象バリエーション。estimateId は estimateNumber から DTO 解決する。 */
  variationId: z.string().min(1, "バリエーションが特定できません"),
});

export type UpdateVariationContentNodeFormInput = z.infer<typeof updateVariationContentNodeSchema>;

/**
 * バリエーション追加スキーマ（C3・新規追加／複製プリフィル）。共通フィールドに、作成時に確定する
 * 不変属性（ADR-0045）の **`submissionType` を加える**（更新の `variationId` は持たない＝新規採番のため）。
 * `version` は追加型でも親集約の楽観ロックトークンとして必須（ADR-0039）。最終ガードはドメイン
 * `SubmissionType.from()`（二重防御の外側）。
 */
export const addVariationNodeSchema = z.object({
  ...variationContentFields,
  submissionType: z.enum(["CUSTOMER", "DELIVERY_LOCATION"], {
    message: "提出区分を選択してください",
  }),
});

export type AddVariationNodeFormInput = z.infer<typeof addVariationNodeSchema>;
