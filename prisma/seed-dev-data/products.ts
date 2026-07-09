/**
 * 開発 seed 専用の商品・価格フィクスチャ（#591）。
 *
 * 方針（計画 設計判断B）: 有効な価格保守対象商品へ共通販売単価＋原価を原則全付与し、画面から
 * 自由に見積を組める土台を作る。承認段階の 4 閾値（10万/100万/1000万/3000万・税込）を現実的な
 * 数量で跨げるよう高額商品（工作機械・生産ライン設備）を含める。保守画面の派生状態を確認する
 * ための「意図的な例外」（未設定・失効・期中改定・得意先別/納品先別上書き）を少数、明示的に残す。
 *
 * 機構は既存 seed-dev.ts 踏襲: 親行は Prisma typed create、期間行（daterange = Unsupported）は
 * $executeRaw で投入する。得意先別/納品先別は共通販売単価と独立した集約（ADR-20260624-8tg）。
 *
 * dev 専用データであり e2e/単体テストとは DB もコードも共有しない（ADR-20260709-f2q）。
 */
import { generateId } from "../../src/server/shared/generateId";
import type { PrismaClient } from "../../generated/prisma/client";

/** 原価の適用開始日（移行 SQL の暦日定数と一致・当年度期首 ADR-0024）。 */
const COST_PRICE_BASE_DATE = "2026-04-01";
/** 共通販売単価の既定適用開始日（無期限 1 本の起点）。 */
const SELLING_PRICE_BASE_DATE = "2025-04-01";

type ProductCategoryLiteral = "INDIVIDUAL" | "CONSUMABLE" | "SET";
type ProductUnitLiteral = "UNIT" | "PIECE" | "ROLL" | "BOX" | "SHEET" | "SET";

/**
 * 開発用商品。costPrice / sellingPrice が null の非 SET 商品は「原価未設定」「共通販売単価未設定」の
 * 例外を表す（保守画面で未設定状態を確認する台）。SET は原価・共通単価を持たず構成から導出するため
 * 常に null。期中改定・失効の商品は sellingPrice を null にして SPECIAL_COMMON_SELLING_PRICES で
 * 期間構造を明示する（general 導出をスキップさせる）。
 */
export type DevProduct = {
  code: string;
  name: string;
  category: ProductCategoryLiteral;
  unit: ProductUnitLiteral;
  isActive: boolean;
  description: string | null;
  costPrice: number | null;
  sellingPrice: number | null;
};

export const PRODUCTS: DevProduct[] = [
  // ===== 個別商品（INDIVIDUAL）: オフィス家具（低価格帯 5千〜10万） =====
  {
    code: "PRD001",
    name: "標準デスク",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "W1200×D700×H720 標準サイズのオフィスデスク",
    costPrice: 15000,
    sellingPrice: null,
  }, // 期中改定 → SPECIAL
  {
    code: "PRD002",
    name: "オフィスチェア",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "エルゴノミクスチェア メッシュバック",
    costPrice: 25000,
    sellingPrice: 45000,
  },
  {
    code: "PRD003",
    name: "モニターアーム",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "シングルモニター用 VESA対応",
    costPrice: 8000,
    sellingPrice: 15000,
  },
  {
    code: "PRD004",
    name: "キーボードトレイ",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "スライド式 後付けタイプ",
    costPrice: 5000,
    sellingPrice: 9000,
  },
  {
    code: "PRD005",
    name: "パーティション",
    category: "INDIVIDUAL",
    unit: "SHEET",
    isActive: true,
    description: "H1800 自立式パーティション",
    costPrice: 12000,
    sellingPrice: 22000,
  },
  {
    code: "PRD006",
    name: "ケーブルダクト",
    category: "INDIVIDUAL",
    unit: "ROLL",
    isActive: true,
    description: "床用ケーブルカバー 1m単位",
    costPrice: 3500,
    sellingPrice: 6000,
  },
  {
    code: "PRD007",
    name: "書庫（両開き）",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "スチール製 両開き書庫",
    costPrice: 30000,
    sellingPrice: null,
  }, // 失効 → SPECIAL
  {
    code: "PRD008",
    name: "ロッカー6人用",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "6人用スチールロッカー",
    costPrice: 40000,
    sellingPrice: 68000,
  },
  {
    code: "PRD009",
    name: "会議テーブル",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "W1800×D900 会議用テーブル",
    costPrice: 60000,
    sellingPrice: 98000,
  },
  {
    code: "PRD010",
    name: "ホワイトボード",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "壁掛け式 W1800",
    costPrice: 18000,
    sellingPrice: 32000,
  },

  // ===== 個別商品: IT機器（中価格帯 2万〜50万） =====
  {
    code: "PRD011",
    name: "ノートPC 標準",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "14インチ ビジネスノートPC",
    costPrice: 90000,
    sellingPrice: 140000,
  },
  {
    code: "PRD012",
    name: "デスクトップPC",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "ミニタワー ビジネス向け",
    costPrice: 80000,
    sellingPrice: 128000,
  },
  {
    code: "PRD013",
    name: "27インチモニター",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "27型 WQHD 液晶モニター",
    costPrice: 35000,
    sellingPrice: 58000,
  },
  {
    code: "PRD014",
    name: "A3複合機",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "A3対応 カラーレーザー複合機",
    costPrice: 250000,
    sellingPrice: 420000,
  },
  {
    code: "PRD015",
    name: "ネットワークスイッチ",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "L2 48ポート ギガビット",
    costPrice: 60000,
    sellingPrice: 98000,
  },
  {
    code: "PRD016",
    name: "UPS無停電電源",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "ラックマウント型 1500VA",
    costPrice: 45000,
    sellingPrice: null,
  }, // 共通販売単価 未設定（例外）
  {
    code: "PRD017",
    name: "ラベルプリンター",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "感熱式 業務用ラベルプリンター",
    costPrice: null,
    sellingPrice: 39000,
  }, // 原価 未設定（例外）
  {
    code: "PRD018",
    name: "プロジェクター",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "3500lm フルHDプロジェクター",
    costPrice: 70000,
    sellingPrice: 120000,
  },

  // ===== 個別商品: 高額設備（閾値跨ぎ用 100万〜3200万） =====
  {
    code: "PRD019",
    name: "サーバーラック一式",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "42U サーバーラック（電源・冷却込み）",
    costPrice: 700000,
    sellingPrice: 1200000,
  }, // 100万↑（部長ゴール）
  {
    code: "PRD020",
    name: "業務用サーバー",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "2Uラックサーバー 冗長構成",
    costPrice: 1500000,
    sellingPrice: 2400000,
  },
  {
    code: "PRD021",
    name: "中型工作機械",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "汎用フライス盤",
    costPrice: 4500000,
    sellingPrice: 6800000,
  },
  {
    code: "PRD022",
    name: "大型工作機械",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "大型マシニングセンタ",
    costPrice: 9000000,
    sellingPrice: 15000000,
  }, // 1500万（本部長）・数量2で3000万↑（社長）
  {
    code: "PRD023",
    name: "生産ライン設備一式",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "自動組立ライン一式",
    costPrice: 20000000,
    sellingPrice: 32000000,
  }, // 3000万↑（社長ゴール）
  {
    code: "PRD024",
    name: "産業用ロボットアーム",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "6軸 多関節ロボット",
    costPrice: 5500000,
    sellingPrice: 8500000,
  },
  {
    code: "PRD025",
    name: "CNC旋盤",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "CNC制御 精密旋盤",
    costPrice: 3200000,
    sellingPrice: 4900000,
  },
  {
    code: "PRD026",
    name: "恒温試験機",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: true,
    description: "恒温恒湿試験槽",
    costPrice: 1800000,
    sellingPrice: 2800000,
  },

  // ===== 個別商品: 無効（販売終了） =====
  {
    code: "PRD027",
    name: "旧型モニター",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: false,
    description: "販売終了品 24インチ液晶",
    costPrice: 20000,
    sellingPrice: 35000,
  },
  {
    code: "PRD028",
    name: "旧型プリンター",
    category: "INDIVIDUAL",
    unit: "UNIT",
    isActive: false,
    description: "販売終了品 A3対応レーザー",
    costPrice: 35000,
    sellingPrice: 55000,
  },

  // ===== 消耗品（CONSUMABLE）: 消耗品のみ免除の確認台。低単価中心 =====
  {
    code: "PRD029",
    name: "コピー用紙A4",
    category: "CONSUMABLE",
    unit: "BOX",
    isActive: true,
    description: "A4 500枚×5冊入り",
    costPrice: 3000,
    sellingPrice: 5000,
  },
  {
    code: "PRD030",
    name: "コピー用紙A3",
    category: "CONSUMABLE",
    unit: "BOX",
    isActive: true,
    description: "A3 500枚×3冊入り",
    costPrice: 4500,
    sellingPrice: 7000,
  },
  {
    code: "PRD031",
    name: "トナーカートリッジ黒",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: true,
    description: null,
    costPrice: 8000,
    sellingPrice: 13000,
  },
  {
    code: "PRD032",
    name: "トナーカートリッジカラー",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: true,
    description: "C/M/Y 3色セット",
    costPrice: 12000,
    sellingPrice: 19000,
  },
  {
    code: "PRD033",
    name: "クリーニングキット",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: true,
    description: "OA機器クリーニング用",
    costPrice: 2500,
    sellingPrice: null,
  }, // 共通販売単価 未設定（例外）
  {
    code: "PRD034",
    name: "ボールペン（箱）",
    category: "CONSUMABLE",
    unit: "BOX",
    isActive: true,
    description: "油性 黒 10本入り",
    costPrice: 800,
    sellingPrice: 1500,
  },
  {
    code: "PRD035",
    name: "付箋セット",
    category: "CONSUMABLE",
    unit: "BOX",
    isActive: true,
    description: "各色 20冊入り",
    costPrice: 600,
    sellingPrice: 1200,
  },
  {
    code: "PRD036",
    name: "ラベルシール",
    category: "CONSUMABLE",
    unit: "SHEET",
    isActive: true,
    description: "A4 24面 100枚",
    costPrice: 400,
    sellingPrice: 800,
  },
  {
    code: "PRD037",
    name: "梱包用テープ",
    category: "CONSUMABLE",
    unit: "ROLL",
    isActive: true,
    description: "OPPテープ 50mm×100m",
    costPrice: 300,
    sellingPrice: 600,
  },
  {
    code: "PRD038",
    name: "インクカートリッジ",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: true,
    description: "大容量 顔料黒",
    costPrice: 5000,
    sellingPrice: 8500,
  },
  {
    code: "PRD039",
    name: "電池単3（パック）",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: true,
    description: "アルカリ 20本パック",
    costPrice: null,
    sellingPrice: 1300,
  }, // 原価 未設定（例外）
  {
    code: "PRD040",
    name: "旧型トナー",
    category: "CONSUMABLE",
    unit: "PIECE",
    isActive: false,
    description: "旧型プリンター用 在庫限り",
    costPrice: 6000,
    sellingPrice: 9500,
  },

  // ===== セット商品（SET）: 原価・共通単価を持たず構成から導出（ADR-0047） =====
  {
    code: "PRD041",
    name: "デスクセット一式",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "デスク＋チェアのセット",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD042",
    name: "モニター環境セット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "モニターアーム＋ケーブルダクトのセット",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD043",
    name: "印刷消耗品セット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "トナー＋用紙のまとめ買いセット",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD044",
    name: "会議室セット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "会議テーブル＋チェア＋ホワイトボード",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD045",
    name: "新入社員PCセット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "ノートPC＋モニター＋チェア",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD046",
    name: "サーバー導入セット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "サーバーラック＋スイッチ＋UPS",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD047",
    name: "旧型デスクセット",
    category: "SET",
    unit: "SET",
    isActive: false,
    description: "販売終了セット商品",
    costPrice: null,
    sellingPrice: null,
  },
  {
    code: "PRD048",
    name: "文具スターターセット",
    category: "SET",
    unit: "SET",
    isActive: true,
    description: "ボールペン＋付箋＋ラベルシール",
    costPrice: null,
    sellingPrice: null,
  },
];

/**
 * セット構成（SetProductComponent・ADR-0047）。SET 商品 → 構成商品（個別/消耗品）の対応。
 * 自動展開（expandSetComponents）が構成を引けるよう、有効な SET 商品に構成を持たせる。無効な
 * PRD047 は構成なし（販売終了品）。
 */
export const SET_COMPONENTS = [
  { setCode: "PRD041", componentCode: "PRD001", quantity: 1 }, // デスクセット = 標準デスク
  { setCode: "PRD041", componentCode: "PRD002", quantity: 1 }, //            + オフィスチェア
  { setCode: "PRD042", componentCode: "PRD003", quantity: 1 }, // モニター環境 = モニターアーム
  { setCode: "PRD042", componentCode: "PRD006", quantity: 2 }, //            + ケーブルダクト×2
  { setCode: "PRD043", componentCode: "PRD031", quantity: 1 }, // 印刷消耗品 = トナー黒
  { setCode: "PRD043", componentCode: "PRD029", quantity: 3 }, //            + コピー用紙A4×3
  { setCode: "PRD044", componentCode: "PRD009", quantity: 1 }, // 会議室 = 会議テーブル
  { setCode: "PRD044", componentCode: "PRD002", quantity: 4 }, //         + チェア×4
  { setCode: "PRD044", componentCode: "PRD010", quantity: 1 }, //         + ホワイトボード
  { setCode: "PRD045", componentCode: "PRD011", quantity: 1 }, // 新入社員PC = ノートPC
  { setCode: "PRD045", componentCode: "PRD013", quantity: 1 }, //           + モニター
  { setCode: "PRD045", componentCode: "PRD002", quantity: 1 }, //           + チェア
  { setCode: "PRD046", componentCode: "PRD019", quantity: 1 }, // サーバー導入 = サーバーラック
  { setCode: "PRD046", componentCode: "PRD015", quantity: 1 }, //            + スイッチ
  { setCode: "PRD046", componentCode: "PRD016", quantity: 1 }, //            + UPS
  { setCode: "PRD048", componentCode: "PRD034", quantity: 1 }, // 文具スターター = ボールペン
  { setCode: "PRD048", componentCode: "PRD035", quantity: 1 }, //              + 付箋
  { setCode: "PRD048", componentCode: "PRD036", quantity: 2 }, //              + ラベルシール×2
];

/**
 * 共通販売単価の期間構造を明示する例外（期中改定・失効）。ここに載る商品は PRODUCTS 側で
 * sellingPrice=null にして general 導出をスキップさせ、この配列の periods で投入する。
 *   - PRD001: 期中改定（2025-10-01 で値上げ）。現在は改定後価格が無期限で適用。
 *   - PRD007: 失効（過去に終了した期間のみ・現在は適用なし）。保守画面で「失効」状態を確認する台。
 */
export const SPECIAL_COMMON_SELLING_PRICES = [
  {
    productCode: "PRD001",
    periods: [
      { start: "2025-04-01", end: "2025-10-01", price: 30000 },
      { start: "2025-10-01", end: null, price: 32000 },
    ],
  },
  {
    productCode: "PRD007",
    periods: [{ start: "2024-04-01", end: "2025-04-01", price: 52000 }], // 失効（現在は無効期間外）
  },
];

/**
 * 得意先別販売単価の上書き（ADR-20260624-8tg）。共通販売単価より優先される得意先固有の価格。
 * 価格解決の優先順位（納品先別 > 得意先別 > 共通）を画面で確認する台。
 */
export const CUSTOMER_PRICE_OVERRIDES = [
  { customerCode: "C002", productCode: "PRD011", price: 132000, start: "2025-04-01", end: null }, // 東京電子: ノートPC 得意先値引
  { customerCode: "C001", productCode: "PRD014", price: 400000, start: "2025-04-01", end: null }, // 山田製作所: A3複合機 得意先値引
];

/**
 * 納品先別販売単価の上書き（ADR-20260624-8tg）。最優先の納品先固有価格。
 */
export const DELIVERY_PRICE_OVERRIDES = [
  { deliveryCode: "D003", productCode: "PRD013", price: 55000, start: "2025-04-01", end: null }, // 東京電子新宿本社: モニター 納品先値引
  { deliveryCode: "D001", productCode: "PRD002", price: 43000, start: "2025-04-01", end: null }, // 山田製作所東京倉庫: チェア 納品先値引
];

/**
 * 商品・セット構成・共通販売単価・原価を投入する。得意先/納品先に依存しないため、
 * 得意先作成前に呼べる（main の商品作成ステップ位置で呼ぶ）。
 */
export async function seedProducts(prisma: PrismaClient): Promise<{
  productCount: number;
  setComponentCount: number;
  commonPricePeriodCount: number;
  costPeriodCount: number;
}> {
  // 商品（スカラー列のみ・id 自前付与のため createMany で一括投入。戻り値は下の findMany で再解決）
  await prisma.product.createMany({
    data: PRODUCTS.map((product) => ({
      id: generateId(),
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      isActive: product.isActive,
      description: product.description,
    })),
  });

  const productsByCode = new Map(
    (await prisma.product.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );

  // セット構成
  await prisma.setProductComponent.createMany({
    data: SET_COMPONENTS.map((c) => ({
      setProductId: productsByCode.get(c.setCode)!,
      componentProductId: productsByCode.get(c.componentCode)!,
      quantity: c.quantity,
    })),
  });

  // 共通販売単価（ADR-0066 / 0067）。有効な非 SET 商品へ原則全付与（sellingPrice 非 null）。
  // 期間行は daterange のため $executeRaw で投入する。期中改定・失効は SPECIAL で別途。
  let commonPricePeriodCount = 0;
  for (const product of PRODUCTS) {
    if (product.category === "SET" || !product.isActive || product.sellingPrice == null) continue;
    const productId = productsByCode.get(product.code)!;
    await prisma.commonSellingPrice.create({ data: { productId } });
    await prisma.$executeRaw`
      INSERT INTO common_selling_price_periods
        (id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${product.sellingPrice}::numeric,
        daterange(${SELLING_PRICE_BASE_DATE}::date, NULL, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    commonPricePeriodCount += 1;
  }
  // 例外（期中改定・失効）
  for (const csp of SPECIAL_COMMON_SELLING_PRICES) {
    const productId = productsByCode.get(csp.productCode);
    if (!productId) continue;
    await prisma.commonSellingPrice.create({ data: { productId } });
    for (const p of csp.periods) {
      await prisma.$executeRaw`
        INSERT INTO common_selling_price_periods
          (id, product_id, selling_price, applicable_period, updated_at)
        VALUES (
          ${generateId()}::uuid,
          ${productId}::uuid,
          ${p.price}::numeric,
          daterange(${p.start}::date, ${p.end}::date, '[)'),
          CURRENT_TIMESTAMP
        )
      `;
      commonPricePeriodCount += 1;
    }
  }

  // 原価集約（ADR-0066 / 0067 / 20260627-a5c）。有効な非 SET 商品へ原則全付与（costPrice 非 null）。
  let costPeriodCount = 0;
  for (const product of PRODUCTS) {
    if (product.category === "SET" || !product.isActive || product.costPrice == null) continue;
    const productId = productsByCode.get(product.code)!;
    await prisma.costPrice.create({ data: { productId } });
    await prisma.$executeRaw`
      INSERT INTO cost_price_periods
        (id, product_id, cost_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${product.costPrice}::numeric,
        daterange(${COST_PRICE_BASE_DATE}::date, NULL, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    costPeriodCount += 1;
  }

  return {
    productCount: PRODUCTS.length,
    setComponentCount: SET_COMPONENTS.length,
    commonPricePeriodCount,
    costPeriodCount,
  };
}

/**
 * 得意先別/納品先別販売単価の上書きを投入する（得意先・納品先の作成後に呼ぶ）。
 * 親行（複合PK）は typed create、期間行（daterange）は $executeRaw。
 */
export async function seedPriceOverrides(prisma: PrismaClient): Promise<{
  customerOverrideCount: number;
  deliveryOverrideCount: number;
}> {
  const productsByCode = new Map(
    (await prisma.product.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );
  const customersByCode = new Map(
    (await prisma.customer.findMany({ select: { id: true, code: true } })).map((c) => [
      c.code,
      c.id,
    ])
  );
  const deliveriesByCode = new Map(
    (await prisma.deliveryLocation.findMany({ select: { id: true, code: true } })).map((d) => [
      d.code,
      d.id,
    ])
  );

  let customerOverrideCount = 0;
  for (const ov of CUSTOMER_PRICE_OVERRIDES) {
    const customerId = customersByCode.get(ov.customerCode);
    const productId = productsByCode.get(ov.productCode);
    if (!customerId || !productId) continue;
    await prisma.customerSellingPrice.create({ data: { customerId, productId } });
    await prisma.$executeRaw`
      INSERT INTO customer_selling_price_periods
        (id, customer_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${customerId}::uuid,
        ${productId}::uuid,
        ${ov.price}::numeric,
        daterange(${ov.start}::date, ${ov.end}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    customerOverrideCount += 1;
  }

  let deliveryOverrideCount = 0;
  for (const ov of DELIVERY_PRICE_OVERRIDES) {
    const deliveryLocationId = deliveriesByCode.get(ov.deliveryCode);
    const productId = productsByCode.get(ov.productCode);
    if (!deliveryLocationId || !productId) continue;
    await prisma.deliveryLocationSellingPrice.create({ data: { deliveryLocationId, productId } });
    await prisma.$executeRaw`
      INSERT INTO delivery_location_selling_price_periods
        (id, delivery_location_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${deliveryLocationId}::uuid,
        ${productId}::uuid,
        ${ov.price}::numeric,
        daterange(${ov.start}::date, ${ov.end}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    deliveryOverrideCount += 1;
  }

  return { customerOverrideCount, deliveryOverrideCount };
}
