/**
 * E2Eテスト専用シードデータ
 *
 * 開発用seed.tsの最小構成版。E2Eテストに必要な最小限のデータのみを作成する。
 * 冪等性: 毎回全データをクリアしてから再作成する。
 */
import { generateId } from "../src/server/shared/generateId";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../generated/prisma/client";
import type { UserRole } from "../src/server/shared/auth/types";
import { USER_ROLES } from "../src/server/shared/auth/types";
import { seedEstimates } from "./seed-estimates";
import { seedEstimateApplications } from "./seed-estimate-applications";

config({ path: ".env.test" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "pass123!";

// --- マスタデータ定義 ---

const DEPARTMENTS = [
  { departmentCd: "DEPT001", name: "営業部", abbreviation: "営業" },
  { departmentCd: "DEPT002", name: "開発部", abbreviation: "開発" },
  { departmentCd: "DEPT003", name: "総務部", abbreviation: "総務" },
];

// E2E専用シード（DEPT9NN 帯）: ドメインエラーテスト用。DB 不変が前提。
// DEPT901/902: 子部署あり削除テスト用（DEPT901 が親、DEPT902 が子）
const E2E_ONLY_DEPARTMENTS = [
  {
    departmentCd: "DEPT901",
    name: "E2E専用_子部署あり削除テスト親部署",
    abbreviation: "E2E親",
    parentDepartmentCd: null as string | null,
  },
  {
    departmentCd: "DEPT902",
    name: "E2E専用_子部署あり削除テスト子部署",
    abbreviation: "E2E子",
    parentDepartmentCd: "DEPT901" as string | null,
  },
];

const POSITIONS = [
  { cd: "POS001", name: "課長", superiorCd: "POS002" as string | null },
  { cd: "POS002", name: "部長", superiorCd: "POS003" as string | null },
  { cd: "POS003", name: "本部長", superiorCd: "POS004" as string | null },
  { cd: "POS004", name: "社長", superiorCd: null },
];

const ROLES = [
  { cd: "ROLE001", name: "社長", positionCd: "POS004", superiorCd: null as string | null },
  {
    cd: "ROLE002",
    name: "営業本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  { cd: "ROLE003", name: "営業部長", positionCd: "POS002", superiorCd: "ROLE002" as string | null },
  { cd: "ROLE004", name: "開発部長", positionCd: "POS002", superiorCd: "ROLE002" as string | null },
  { cd: "ROLE005", name: "営業課長", positionCd: "POS001", superiorCd: "ROLE003" as string | null },
  {
    cd: "ROLE006",
    name: "管理本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  // 課員の上位役割を同部署の課長級（POS001）へ揃えるため追加（ADR-20260707-k4e）。
  // 開発課長→開発部長、総務課長→総務部長→管理本部長 と役職階層1段ずつ上へ連なる。
  { cd: "ROLE007", name: "開発課長", positionCd: "POS001", superiorCd: "ROLE004" as string | null },
  { cd: "ROLE008", name: "総務部長", positionCd: "POS002", superiorCd: "ROLE006" as string | null },
  { cd: "ROLE009", name: "総務課長", positionCd: "POS001", superiorCd: "ROLE008" as string | null },
];

// E2E専用シード（ROLE9NN 帯）: ドメインエラーテスト用。DB 不変が前提。
// ROLE901/902: 下位役割あり削除テスト用（ROLE901 が親、ROLE902 が子）
// ROLE903: 使用中削除テスト用（E2E 専用従業員 EMP999001 に割り当て）
const E2E_ONLY_ROLES = [
  {
    cd: "ROLE901",
    name: "E2E専用_下位役割あり削除テスト親役割",
    positionCd: "POS004",
    superiorCd: null as string | null,
  },
  {
    cd: "ROLE902",
    name: "E2E専用_下位役割あり削除テスト子役割",
    positionCd: "POS003",
    superiorCd: "ROLE901" as string | null,
  },
  {
    cd: "ROLE903",
    name: "E2E専用_使用中削除テスト役割",
    positionCd: "POS001",
    superiorCd: "ROLE003" as string | null,
  },
];

// E2E専用従業員: ROLE903 を「使用中」にするための従業員。DB 不変が前提。
const E2E_ONLY_EMPLOYEES = [
  {
    employeeCd: "EMP999001",
    email: "e2e-only-001@example.com",
    name: "E2E専用_使用中テスト従業員",
    departmentCd: "DEPT001",
    assignedRoleCd: "ROLE903",
  },
];

// 役割を持つ従業員の設定（EMP000001〜EMP000007）
// 最初の2名は固定ユーザー（認証用）
const ROLE_EMPLOYEE_CONFIGS = [
  { roleCd: "ROLE001", departmentCd: "DEPT001" }, // EMP000001: 社長（admin固定ユーザー）
  { roleCd: "ROLE002", departmentCd: "DEPT001" }, // EMP000002: 営業本部長（user固定ユーザー）
  { roleCd: "ROLE003", departmentCd: "DEPT001" }, // EMP000003: 営業部長
  { roleCd: "ROLE004", departmentCd: "DEPT002" }, // EMP000004: 開発部長
  { roleCd: "ROLE005", departmentCd: "DEPT001" }, // EMP000005: 営業課長
];

// 固定ユーザー（auth.setup.tsと整合）
const FIXED_USERS = [
  { name: "管理 ユーザ", role: USER_ROLES.ADMIN },
  { name: "一般 ユーザ", role: USER_ROLES.USER },
] as const;

// 一般従業員（EMP000006〜EMP000020）の部署割り当て。
// 上位役割は同部署の課長級（POS001）に揃える（ADR-20260707-k4e。旧・部長級/越境を是正）。
const GENERAL_EMPLOYEES = [
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" }, // 営業部 → 営業課長
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE007" }, // 開発部 → 開発課長
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE007" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE007" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE007" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE007" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE009" }, // 総務部 → 総務課長
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE009" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE009" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE009" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE009" },
];

// 従業員の名前（固定: ランダム性を排除してテストの再現性を確保）
const EMPLOYEE_NAMES = [
  "管理 ユーザ", // EMP000001 (固定)
  "一般 ユーザ", // EMP000002 (固定)
  "佐藤 太郎", // EMP000003
  "鈴木 次郎", // EMP000004
  "高橋 三郎", // EMP000005
  "田中 健太", // EMP000006
  "伊藤 翔太", // EMP000007
  "渡辺 大輝", // EMP000008
  "山本 拓也", // EMP000009
  "中村 直樹", // EMP000010
  "小林 花子", // EMP000011
  "加藤 愛子", // EMP000012
  "吉田 美咲", // EMP000013
  "山田 さくら", // EMP000014
  "佐々木 陽子", // EMP000015
  "山口 恵子", // EMP000016
  "松本 真由美", // EMP000017
  "井上 裕子", // EMP000018
  "木村 智子", // EMP000019
  "林 由美", // EMP000020
];

// 得意先データ（最小構成: 3社 + 5納品先）
const CUSTOMERS = [
  {
    code: "C001",
    name: "株式会社山田製作所",
    postalCode: "1000001",
    prefecture: "東京都",
    address: "千代田区千代田1-1-1",
    phoneNumber: "0312345678",
    faxNumber: "0312345679",
    contactPerson: "山田 太郎",
    isActive: true,
    deliveryLocations: [
      {
        code: "D001",
        name: "山田製作所 東京倉庫",
        postalCode: "1350061",
        prefecture: "東京都",
        address: "江東区豊洲3-2-1",
        phoneNumber: "0362345678",
        deliveryNotes: "平日9:00-17:00のみ受付",
      },
      {
        code: "D002",
        name: "山田製作所 埼玉工場",
        postalCode: "3300801",
        prefecture: "埼玉県",
        address: "さいたま市大宮区土手町1-10-5",
        phoneNumber: "0486001234",
        deliveryNotes: "正門からお入りください",
      },
    ],
  },
  {
    code: "C002",
    name: "東京電子工業株式会社",
    postalCode: "1600023",
    prefecture: "東京都",
    address: "新宿区西新宿2-8-1",
    phoneNumber: "0333456789",
    faxNumber: "0333456780",
    contactPerson: "鈴木 一郎",
    isActive: true,
    deliveryLocations: [
      {
        code: "D003",
        name: "東京電子 新宿本社",
        postalCode: "1600023",
        prefecture: "東京都",
        address: "新宿区西新宿2-8-1 B1F",
        phoneNumber: "0333456781",
        deliveryNotes: "地下搬入口よりお願いします",
      },
    ],
  },
  {
    code: "C003",
    name: "大阪機械工業株式会社",
    postalCode: "5300001",
    prefecture: "大阪府",
    address: "大阪市北区梅田1-3-1",
    phoneNumber: "0661234567",
    faxNumber: "0661234568",
    contactPerson: "田中 健太",
    isActive: true,
    deliveryLocations: [
      {
        code: "D004",
        name: "大阪機械 梅田本社",
        postalCode: "5300001",
        prefecture: "大阪府",
        address: "大阪市北区梅田1-3-1 5F",
        phoneNumber: "0661234569",
        deliveryNotes: "エレベーターは貨物用をご利用ください",
      },
      {
        code: "D005",
        name: "大阪機械 堺工場",
        postalCode: "5900001",
        prefecture: "大阪府",
        address: "堺市堺区北丸保園1-1",
        phoneNumber: "0722001234",
        deliveryNotes: "平日8:30-16:30受付",
      },
      {
        code: "D007",
        name: "大阪機械 東大阪倉庫",
        postalCode: "5770066",
        prefecture: "大阪府",
        address: "東大阪市高井田本通1-3-5",
        phoneNumber: null,
        deliveryNotes: null,
        isActive: false,
      },
    ],
  },
  {
    code: "C004",
    name: "名古屋精密機器株式会社",
    postalCode: "4600008",
    prefecture: "愛知県",
    address: "名古屋市中区栄3-5-1",
    phoneNumber: "0521234567",
    faxNumber: "0521234568",
    contactPerson: "佐藤 花子",
    isActive: false,
    deliveryLocations: [],
  },
  {
    code: "C005",
    name: "福岡商事株式会社",
    postalCode: "8100001",
    prefecture: "福岡県",
    address: "福岡市中央区天神1-1-1",
    phoneNumber: "0921234567",
    faxNumber: null,
    contactPerson: null,
    isActive: true,
    deliveryLocations: [
      {
        code: "D006",
        name: "福岡商事 天神本社",
        postalCode: "8100001",
        prefecture: "福岡県",
        address: "福岡市中央区天神1-1-1 3F",
        phoneNumber: "0921234568",
        deliveryNotes: "ビル正面入口よりお入りください",
      },
    ],
  },
  // C901/D901: E2E専用_納品先あり削除テスト用（skill §13 / Issue #261・failure-only・DB 不変）
  {
    code: "C901",
    name: "E2E専用_納品先あり削除テスト用得意先",
    postalCode: "1000005",
    prefecture: "東京都",
    address: "千代田区丸の内1-9-1",
    phoneNumber: "0399990901",
    faxNumber: null,
    contactPerson: null,
    isActive: true,
    deliveryLocations: [
      {
        code: "D901",
        name: "E2E専用_納品先あり削除テスト用納品先",
        postalCode: "1000005",
        prefecture: "東京都",
        address: "千代田区丸の内1-9-1 1F",
        phoneNumber: "0399990902",
        deliveryNotes: "E2E専用_削除不可検証用",
      },
    ],
  },
  // C902: 得意先別販売単価 一覧 E2E 用（#508）。PRD86x 帯への上書き期間は
  // seedCustomerSellingPrices で today 相対 raw insert する。他テストの得意先と
  // 分離し、上書きフィクスチャの影響が見積系テストへ波及しないようにする。
  {
    code: "C902",
    name: "E2E専用_得意先別単価テスト商事",
    postalCode: "1000006",
    prefecture: "東京都",
    address: "千代田区有楽町1-1-2",
    phoneNumber: "0399990903",
    faxNumber: null,
    contactPerson: null,
    isActive: true,
    deliveryLocations: [],
  },
  // C904: 得意先別販売単価 管理画面 CRUD E2E 用（#509）。閲覧系 C902 と分離した変更系専用得意先。
  // PRD867〜869 への上書きは seed せず、CRUD chain がテスト内で登録→編集→適用終了→改定→削除する。
  // 隔離の自然な単位は商品ではなく得意先（一覧画面が得意先スコープのビューのため）。
  // 得意先コードは develop 側 #548 が C903 を納品先別テストで先取りしたため C904 に退避（マージ解決）。
  {
    code: "C904",
    name: "E2E専用_得意先別単価CRUD商事",
    postalCode: "1000007",
    prefecture: "東京都",
    address: "千代田区有楽町1-1-3",
    phoneNumber: "0399990904",
    faxNumber: null,
    contactPerson: null,
    isActive: true,
    deliveryLocations: [],
  },
  // C903: 納品先別販売単価 一覧 E2E 用（#548）。D902（有効）× PRD87x 帯への納品先別上書き期間は
  // seedDeliveryLocationSellingPrices で today 相対 raw insert する。得意先別 C902 帯と分離し、
  // 納品先別フィクスチャの影響が他テストへ波及しないようにする。D903 は無効納品先ヘッダバッジ検証用
  // （セレクタ検索は有効のみのため直接 URL でのみ到達＝新規に選ぶ動線には出さないが状況確認は拒まない）。
  {
    code: "C903",
    name: "E2E専用_納品先別単価テスト商事",
    postalCode: "1000007",
    prefecture: "東京都",
    address: "千代田区有楽町1-1-3",
    phoneNumber: "0399990904",
    faxNumber: null,
    contactPerson: null,
    isActive: true,
    deliveryLocations: [
      {
        code: "D902",
        name: "E2E専用_納品先別単価テスト納品先",
        postalCode: "1000007",
        prefecture: "東京都",
        address: "千代田区有楽町1-1-3 1F",
        phoneNumber: "0399990905",
        deliveryNotes: "E2E専用_納品先別単価テスト（有効・グローバル検索の対象）",
      },
      {
        code: "D903",
        name: "E2E専用_納品先別単価テスト無効納品先",
        postalCode: "1000007",
        prefecture: "東京都",
        address: "千代田区有楽町1-1-3 2F",
        phoneNumber: "0399990906",
        deliveryNotes: "E2E専用_納品先別単価テスト（無効・ヘッダバッジ検証用・直接 URL 到達）",
        isActive: false,
      },
      // D904: 納品先別販売単価 管理画面 CRUD/詳細 E2E 用（#549）。閲覧系 D902 帯と分離した変更系専用納品先。
      // PRD877〜879 への上書きは seed せず、CRUD chain がテスト内で登録→編集→適用終了→改定→削除する。
      // 隔離の自然な単位は商品ではなく納品先（一覧画面が納品先スコープのビューのため）。名称に
      // 「納品先別単価テスト」を含めない（一覧のグローバル検索・件数断定＝name=納品先別単価テスト に触れないため）。
      {
        code: "D904",
        name: "E2E専用_納品先別単価CRUD納品先",
        postalCode: "1000007",
        prefecture: "東京都",
        address: "千代田区有楽町1-1-3 3F",
        phoneNumber: "0399990907",
        deliveryNotes: "E2E専用_納品先別単価CRUD（有効・変更系専用・直接 URL 到達）",
      },
    ],
  },
];

// 商品データ（各区分 + 有効/無効を含む）
const PRODUCTS = [
  {
    code: "PRD001",
    name: "標準デスク",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 15000,
    isActive: true,
    description: "標準サイズのオフィスデスク",
  },
  {
    code: "PRD002",
    name: "オフィスチェア",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 25000,
    isActive: true,
    description: "エルゴノミクスチェア",
  },
  {
    code: "PRD003",
    name: "コピー用紙A4",
    category: "CONSUMABLE" as const,
    unit: "BOX" as const,
    costPrice: 3000,
    isActive: true,
    description: null,
  },
  {
    code: "PRD004",
    name: "トナーカートリッジ",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 8000,
    isActive: true,
    description: null,
  },
  {
    code: "PRD005",
    name: "デスクセット一式",
    category: "SET" as const,
    unit: "SET" as const,
    costPrice: null,
    isActive: true,
    description: "デスク＋チェアのセット",
  },
  {
    code: "PRD006",
    name: "旧型モニター",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 20000,
    isActive: false,
    description: "販売終了品",
  },
  // S4 周辺商品サジェスト（D6）E2E 用の専用商品。本体 PRD810 に周辺 PRD811 を関連付ける。
  {
    code: "PRD810",
    name: "S4周辺テスト本体",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: 12000,
    isActive: true,
    description: "S4 周辺商品サジェスト E2E 用（本体）",
  },
  {
    code: "PRD811",
    name: "S4周辺テスト周辺",
    category: "CONSUMABLE" as const,
    unit: "PIECE" as const,
    costPrice: 2000,
    isActive: true,
    description: "S4 周辺商品サジェスト E2E 用（周辺）",
  },
  // 共通販売単価 保守 E2E 用（PRD82x 帯・#481）。costPrice は null とし原価集約を作らない
  // （CSP 関心に閉じたフィクスチャ）。CSP 期間は seedCommonSellingPrices で today 相対 raw insert する。
  {
    code: "PRD820",
    name: "CSP_3状態テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（失効/現在有効/将来の3期間）",
  },
  {
    code: "PRD821",
    name: "CSP_未設定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（CSP 集約なし＝未設定）",
  },
  {
    code: "PRD822",
    name: "CSP_登録編集削除テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（CRUD Chain A・テスト内で期間生成）",
  },
  {
    code: "PRD823",
    name: "CSP_失効のみテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（失効期間のみ＝失効中）",
  },
  {
    code: "PRD824",
    name: "CSP_適用終了改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（CRUD Chain B・テスト内で期間生成）",
  },
  {
    code: "PRD825",
    name: "CSP_ガイド付き改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 E2E（ガイド付き単価改定 Chain・テスト内で期間生成）",
  },
  {
    code: "PRD826",
    name: "CSP_現在有効無期限テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "共通販売単価 一覧 E2E（現在有効・無期限＝適用期間列 開始〜無期限の検証用・#513）",
  },
  // 原価 E2E 用（PRD84x 帯・#501/#504）。costPrice は null とし PRODUCTS 由来の既定原価集約
  // （2026-04-01 起点）を作らせず、seedCostPrices で today 相対 raw insert する。
  // 一覧（#501）: 3状態＋適用期間列（有界／無期限）の検証用に active（有界）・active（無期限）・
  //   lapsed・unset を用意する（PRD840〜843）。
  // 保守（#504）: 詳細3状態表示・重複拒否（PRD844=3期間・DB不変）と、CRUD/改定チェーン用に
  //   期間なし商品（PRD845〜847・テスト内で期間生成）を用意する。売単価 PRD820/822/824/825 の同型ミラー。
  {
    code: "PRD840",
    name: "COST_現在有効有界テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 一覧 E2E（現在有効・有界期間）",
  },
  {
    code: "PRD841",
    name: "COST_現在有効無期限テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 一覧 E2E（現在有効・無期限）",
  },
  {
    code: "PRD842",
    name: "COST_失効のみテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 一覧 E2E（失効期間のみ＝失効中）",
  },
  {
    code: "PRD843",
    name: "COST_未設定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 一覧 E2E（原価集約なし＝未設定）",
  },
  {
    code: "PRD844",
    name: "COST_3状態テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 保守 E2E（失効/現在有効/将来の3期間・詳細表示と重複拒否・DB不変）",
  },
  {
    code: "PRD845",
    name: "COST_登録編集削除テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 保守 E2E（CRUD Chain A・テスト内で期間生成）",
  },
  {
    code: "PRD846",
    name: "COST_適用終了改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 保守 E2E（CRUD Chain B・テスト内で期間生成）",
  },
  {
    code: "PRD847",
    name: "COST_ガイド付き改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "原価 保守 E2E（ガイド付き単価改定 Chain・テスト内で期間生成）",
  },
  // 得意先別販売単価 E2E 用（PRD86x 帯・#508）。costPrice は null とし原価集約を作らない。
  // 得意先 C902 に対する上書き期間・共通単価は seedCustomerSellingPrices で today 相対 raw insert する。
  // 商品名は「得意先単価」前置で統一し、E2E の商品名部分一致検索で帯全体に絞り込めるようにする。
  {
    code: "PRD860",
    name: "得意先単価_有効有界テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "得意先別販売単価 一覧 E2E（上書き有効・有界期間＋共通単価あり＝並記の検証用）",
  },
  {
    code: "PRD861",
    name: "得意先単価_有効無期限テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "得意先別販売単価 一覧 E2E（上書き有効・無期限＋共通単価なし＝期間列 開始〜無期限）",
  },
  {
    code: "PRD862",
    name: "得意先単価_失効テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "得意先別販売単価 一覧 E2E（上書き失効のみ＋共通単価あり＝失効中でも共通は生きる対比）",
  },
  {
    code: "PRD863",
    name: "得意先単価_上書きなしテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "得意先別販売単価 一覧 E2E（上書きなし＋共通単価あり＝既定価格の読める上書きなし行）",
  },
  {
    code: "PRD864",
    name: "得意先単価_上書きなし共通なしテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "得意先別販売単価 一覧 E2E（上書きなし＋共通単価なし＝両列空欄）",
  },
  {
    code: "PRD865",
    name: "得意先単価_無効商品テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: false,
    description: "得意先別販売単価 一覧 E2E（無効商品＋上書き有効＝行の無効バッジ・弾かず可視化）",
  },
  // PRD866: 得意先別販売単価 詳細（管理画面）閲覧系 E2E 用（#509）。C902 に失効/現在有効/将来の
  // 3状態上書き＋共通1本を持たせ、3状態バッジ・操作ボタン出し分け・タイムライン従レーンを検証する。
  // 得意先単価_ 接頭辞のため一覧テストの name=得意先単価 絞り込みに現れるが、一覧の assertion は
  // 行スコープ（商品コード指定）のみで件数を見ないため干渉しない。現在有効を持つので filter=none /
  // filter=lapsed の結果にも入らない。上書き期間・共通単価は seedCustomerSellingPrices で raw insert する。
  {
    code: "PRD866",
    name: "得意先単価_詳細3状態テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "得意先別販売単価 詳細 E2E（失効/現在有効/将来の3状態＋共通1本＝バッジ・出し分け・タイムライン従レーン）",
  },
  // PRD867〜869: 得意先別販売単価 管理画面 CRUD E2E 用（#509）。得意先 C904 に閉じ、上書き期間は
  // seed せず CRUD chain がテスト内で構築する（登録→編集→適用終了→改定→削除）。costPrice は null。
  // 商品名の「得意先単価CRUD_」前置は C902 帯（得意先単価_）との視認上の区別であり、一覧テストの
  // name=得意先単価 部分一致検索には PRD866 帯と同様にヒットする。一覧の assertion は行スコープ
  // （商品コード指定）のみで件数を見ないため干渉しない。件数 assertion を足す場合はこの前提が崩れる。
  {
    code: "PRD867",
    name: "得意先単価CRUD_登録編集削除テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "得意先別販売単価 CRUD E2E Chain A（将来期間 登録→編集→削除→#512同型再登録）",
  },
  {
    code: "PRD868",
    name: "得意先単価CRUD_適用終了改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "得意先別販売単価 CRUD E2E Chain B（現在有効 登録→適用終了→隣接将来追加）",
  },
  {
    code: "PRD869",
    name: "得意先単価CRUD_ガイド改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "得意先別販売単価 CRUD E2E Chain C（現在有効 登録→ガイド付き単価改定）",
  },
  // 納品先別販売単価 E2E 用（PRD87x 帯・#548）。costPrice は null とし原価集約を作らない。
  // 納品先 D902 に対する納品先別上書き期間・共通単価は seedDeliveryLocationSellingPrices で
  // today 相対 raw insert する。商品名は「納品先単価」前置で統一し、E2E の商品名部分一致検索で
  // 帯全体に絞り込めるようにする（得意先別 PRD86x 帯とは別帯にして結合汚染を避ける）。
  {
    code: "PRD870",
    name: "納品先単価_有効有界テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "納品先別販売単価 一覧 E2E（上書き有効・有界期間＋共通単価あり＝並記の検証用）",
  },
  {
    code: "PRD871",
    name: "納品先単価_有効無期限テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "納品先別販売単価 一覧 E2E（上書き有効・無期限＋共通単価なし＝期間列 開始〜無期限）",
  },
  {
    code: "PRD872",
    name: "納品先単価_失効テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "納品先別販売単価 一覧 E2E（上書き失効のみ＋共通単価あり＝失効中でも共通は生きる対比）",
  },
  {
    code: "PRD873",
    name: "納品先単価_上書きなしテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "納品先別販売単価 一覧 E2E（上書きなし＋共通単価あり＝既定価格の読める上書きなし行）",
  },
  {
    code: "PRD874",
    name: "納品先単価_上書きなし共通なしテスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "納品先別販売単価 一覧 E2E（上書きなし＋共通単価なし＝両列空欄）",
  },
  {
    code: "PRD875",
    name: "納品先単価_無効商品テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: false,
    description: "納品先別販売単価 一覧 E2E（無効商品＋上書き有効＝行の無効バッジ・弾かず可視化）",
  },
  // PRD876: 納品先別販売単価 詳細（管理画面）閲覧系 E2E 用（#549）。D904 に失効/現在有効/将来の
  // 3状態上書きを持たせ、加えて得意先別（C903）1本・共通1本を併設して3段フォールバック（納品先別→得意先別
  // →共通）のタイムライン3レーンを全埋めする。3状態バッジ・操作ボタン出し分け・重複拒否母体（DB 不変）を兼ねる。
  // 上書き期間・得意先別・共通は seedDeliveryLocationSellingPrices で raw insert する。
  {
    code: "PRD876",
    name: "納品先単価_詳細3状態テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description:
      "納品先別販売単価 詳細 E2E（失効/現在有効/将来の3状態＋得意先別1本＋共通1本＝バッジ・出し分け・3レーンタイムライン）",
  },
  // PRD877〜879: 納品先別販売単価 管理画面 CRUD E2E 用（#549）。納品先 D904 に閉じ、上書き期間は
  // seed せず CRUD chain がテスト内で構築する（登録→編集→適用終了→改定→削除）。costPrice は null。
  // 商品名の「納品先単価CRUD_」前置は D902 帯（納品先単価_）との視認上の区別。一覧の name=納品先単価
  // 部分一致検索には PRD876 帯と同様にヒットするが、一覧の assertion は行スコープ（商品コード指定）のみで
  // 件数を見ないため干渉しない。件数 assertion を足す場合はこの前提が崩れる。
  {
    code: "PRD877",
    name: "納品先単価CRUD_登録編集削除テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "納品先別販売単価 CRUD E2E Chain A（将来期間 登録→編集→削除→#512同型再登録）",
  },
  {
    code: "PRD878",
    name: "納品先単価CRUD_適用終了改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "納品先別販売単価 CRUD E2E Chain B（現在有効 登録→適用終了→隣接将来追加）",
  },
  {
    code: "PRD879",
    name: "納品先単価CRUD_ガイド改定テスト商品",
    category: "INDIVIDUAL" as const,
    unit: "UNIT" as const,
    costPrice: null,
    isActive: true,
    description: "納品先別販売単価 CRUD E2E Chain C（現在有効 登録→ガイド付き単価改定）",
  },
];

// --- 共通販売単価 E2E フィクスチャ（#481・ADR-20260629-3x5）---

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 実行時の今日（JST 暦日）に dayOffset 日を加えた `"YYYY-MM-DD"` を返す。
 * toJstCalendarDay と同じ +9h ロジックで JST 暦日を求め、暦日同士を UTC で日加算する
 * （ローカル TZ 非依存・DST なし）。テスト側の日付生成と突き合わせる起点。
 */
function jstRelativeDate(dayOffset: number): string {
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const baseUtcMs = Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate());
  const shifted = new Date(baseUtcMs + dayOffset * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 共通販売単価の E2E フィクスチャを投入する（PRD82x 帯・today 相対）。
 * - PRD820: 失効`[today-60,today-30)`¥1000 / 現在有効`[today-30,today+30)`¥2000 / 将来`[today+30,∞)`¥3000
 * - PRD823: 失効`[today-60,today-30)`¥1500
 * - PRD826: 現在有効・無期限`[today-30,∞)`¥2500（適用期間列＝開始〜無期限の検証用・#513）
 * - PRD821/822/824/825: CSP 集約を作らない（未設定で開始。822/824/825 はテスト内で期間を生成）
 *
 * 期間は EXCLUDE 制約（同一商品で適用期間の重複不可・ADR-0067）を満たすよう半開区間で隣接させる。
 * 過去開始は集約の assertStartNotPast を通せないため raw daterange insert で投入する。
 */
async function seedCommonSellingPrices(productIdByCode: Map<string, string>): Promise<void> {
  const insertPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO common_selling_price_periods
        (id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const prd901 = productIdByCode.get("PRD820");
  if (prd901) {
    await prisma.commonSellingPrice.create({ data: { productId: prd901 } });
    await insertPeriod(prd901, 1000, jstRelativeDate(-60), jstRelativeDate(-30)); // 失効
    await insertPeriod(prd901, 2000, jstRelativeDate(-30), jstRelativeDate(30)); // 現在有効
    await insertPeriod(prd901, 3000, jstRelativeDate(30), null); // 将来（無期限）
  }

  const prd904 = productIdByCode.get("PRD823");
  if (prd904) {
    await prisma.commonSellingPrice.create({ data: { productId: prd904 } });
    await insertPeriod(prd904, 1500, jstRelativeDate(-60), jstRelativeDate(-30)); // 失効のみ
  }

  const prd826 = productIdByCode.get("PRD826");
  if (prd826) {
    await prisma.commonSellingPrice.create({ data: { productId: prd826 } });
    await insertPeriod(prd826, 2500, jstRelativeDate(-30), null); // 現在有効・無期限
  }

  console.log(
    "Created common selling prices (PRD820: 3 periods / PRD823: 1 period / PRD826: 1 period)"
  );
}

/**
 * 原価の E2E フィクスチャを投入する（PRD84x 帯・today 相対・#501/#504・ADR-20260629-3x5）。
 * 一覧（#501）:
 * - PRD840: 現在有効・有界 `[today-30, today+30)` ¥1000（適用期間列＝開始〜終了の検証用）
 * - PRD841: 現在有効・無期限 `[today-30, ∞)` ¥1500（適用期間列＝開始〜無期限の検証用）
 * - PRD842: 失効のみ `[today-60, today-30)` ¥800（現在有効行なし＝失効中・期間列は空欄）
 * - PRD843: 原価集約を作らない（未設定＝期間列は空欄）
 * 保守（#504）:
 * - PRD844: 失効`[today-60,today-30)`¥1000 / 現在有効`[today-30,today+30)`¥2000 / 将来`[today+30,∞)`¥3000
 *   （詳細の3状態バッジ表示と重複拒否の検証用。売単価 PRD820 の完全ミラー）
 * - PRD845/846/847: 原価集約を作らない（未設定で開始。CRUD/改定チェーンがテスト内で期間を生成する）
 *
 * seedCommonSellingPrices と同型。過去開始（失効）は集約の assertStartNotPast を通せないため
 * raw daterange insert で投入する。既存 PRD82x 帯（原価集約なし前提）には手を触れない。
 */
async function seedCostPrices(productIdByCode: Map<string, string>): Promise<void> {
  const insertPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO cost_price_periods
        (id, product_id, cost_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const prd840 = productIdByCode.get("PRD840");
  if (prd840) {
    await prisma.costPrice.create({ data: { productId: prd840 } });
    await insertPeriod(prd840, 1000, jstRelativeDate(-30), jstRelativeDate(30)); // 現在有効・有界
  }

  const prd841 = productIdByCode.get("PRD841");
  if (prd841) {
    await prisma.costPrice.create({ data: { productId: prd841 } });
    await insertPeriod(prd841, 1500, jstRelativeDate(-30), null); // 現在有効・無期限
  }

  const prd842 = productIdByCode.get("PRD842");
  if (prd842) {
    await prisma.costPrice.create({ data: { productId: prd842 } });
    await insertPeriod(prd842, 800, jstRelativeDate(-60), jstRelativeDate(-30)); // 失効のみ
  }

  const prd844 = productIdByCode.get("PRD844");
  if (prd844) {
    await prisma.costPrice.create({ data: { productId: prd844 } });
    await insertPeriod(prd844, 1000, jstRelativeDate(-60), jstRelativeDate(-30)); // 失効
    await insertPeriod(prd844, 2000, jstRelativeDate(-30), jstRelativeDate(30)); // 現在有効
    await insertPeriod(prd844, 3000, jstRelativeDate(30), null); // 将来（無期限）
  }

  console.log(
    "Created cost prices (PRD840: bounded active / PRD841: unbounded active / PRD842: expired / PRD844: 3 periods)"
  );
}

/**
 * 得意先別販売単価の E2E フィクスチャを投入する（得意先 C902 × PRD86x 帯・today 相対・#508）。
 * 一覧画面の3状態（active/lapsed/none）と共通単価並記カラムの表示分岐を全て踏めるよう、
 * 上書き（得意先層）× 共通（フォールバック層）の組み合わせを商品ごとに変える:
 * - PRD860: 上書き有効・有界 `[today-30, today+30)` ¥1800 ＋ 共通 `[today-30, ∞)` ¥2000（並記の基準ケース）
 * - PRD861: 上書き有効・無期限 `[today-30, ∞)` ¥900 ＋ 共通なし（期間列 開始〜無期限・共通列空欄）
 * - PRD862: 上書き失効のみ `[today-60, today-30)` ¥1400 ＋ 共通 `[today-30, ∞)` ¥1200（失効中でも共通は生きる対比）
 * - PRD863: 上書きなし ＋ 共通 `[today-30, ∞)` ¥1100（none 行で既定価格が読めるケース）
 * - PRD864: 上書きなし ＋ 共通なし（両列空欄）
 * - PRD865: 無効商品 ＋ 上書き有効 `[today-30, today+30)` ¥700（行の無効バッジ・弾かず可視化）
 * - PRD866: 詳細閲覧系（#509）。上書き 失効`[today-60,today-30)`¥1000 / 現在有効`[today-30,today+30)`¥2000 /
 *   将来`[today+30,∞)`¥3000 ＋ 共通 `[today-30, ∞)` ¥2500（3状態バッジ・出し分け・タイムライン従レーン検証）
 *
 * seedCommonSellingPrices と同型。過去開始（失効）は集約の assertStartNotPast を通せないため
 * raw daterange insert で投入する。期間行は親集約（customer_selling_prices・複合PK）を先に作る。
 * 無効得意先ヘッダバッジの検証は既存 C004（無効・上書きなし）への直接 URL で行うため追加投入なし。
 */
async function seedCustomerSellingPrices(productIdByCode: Map<string, string>): Promise<void> {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { code: "C902" },
    select: { id: true },
  });

  const insertCustomerPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO customer_selling_price_periods
        (id, customer_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${customer.id}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const insertCommonPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO common_selling_price_periods
        (id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const prd860 = productIdByCode.get("PRD860");
  if (prd860) {
    await prisma.customerSellingPrice.create({
      data: { customerId: customer.id, productId: prd860 },
    });
    await insertCustomerPeriod(prd860, 1800, jstRelativeDate(-30), jstRelativeDate(30)); // 上書き有効・有界
    await prisma.commonSellingPrice.create({ data: { productId: prd860 } });
    await insertCommonPeriod(prd860, 2000, jstRelativeDate(-30), null); // 共通・現在有効
  }

  const prd861 = productIdByCode.get("PRD861");
  if (prd861) {
    await prisma.customerSellingPrice.create({
      data: { customerId: customer.id, productId: prd861 },
    });
    await insertCustomerPeriod(prd861, 900, jstRelativeDate(-30), null); // 上書き有効・無期限（共通なし）
  }

  const prd862 = productIdByCode.get("PRD862");
  if (prd862) {
    await prisma.customerSellingPrice.create({
      data: { customerId: customer.id, productId: prd862 },
    });
    await insertCustomerPeriod(prd862, 1400, jstRelativeDate(-60), jstRelativeDate(-30)); // 上書き失効のみ
    await prisma.commonSellingPrice.create({ data: { productId: prd862 } });
    await insertCommonPeriod(prd862, 1200, jstRelativeDate(-30), null); // 共通・現在有効
  }

  const prd863 = productIdByCode.get("PRD863");
  if (prd863) {
    await prisma.commonSellingPrice.create({ data: { productId: prd863 } });
    await insertCommonPeriod(prd863, 1100, jstRelativeDate(-30), null); // 上書きなし＋共通のみ
  }

  // PRD864: 上書きなし＋共通なし（投入なし）

  const prd865 = productIdByCode.get("PRD865");
  if (prd865) {
    await prisma.customerSellingPrice.create({
      data: { customerId: customer.id, productId: prd865 },
    });
    await insertCustomerPeriod(prd865, 700, jstRelativeDate(-30), jstRelativeDate(30)); // 無効商品＋上書き有効
  }

  // PRD866: 詳細（管理画面）閲覧系（#509）。失効/現在有効/将来の3状態上書き＋共通1本（従レーン用）。
  // 共通は現在有効・無期限 1 本のみとし、主レーン bar 3 本・従レーン secondary-bar 1 本のタイムラインを作る。
  const prd866 = productIdByCode.get("PRD866");
  if (prd866) {
    await prisma.customerSellingPrice.create({
      data: { customerId: customer.id, productId: prd866 },
    });
    await insertCustomerPeriod(prd866, 1000, jstRelativeDate(-60), jstRelativeDate(-30)); // 上書き・失効
    await insertCustomerPeriod(prd866, 2000, jstRelativeDate(-30), jstRelativeDate(30)); // 上書き・現在有効
    await insertCustomerPeriod(prd866, 3000, jstRelativeDate(30), null); // 上書き・将来（無期限）
    await prisma.commonSellingPrice.create({ data: { productId: prd866 } });
    await insertCommonPeriod(prd866, 2500, jstRelativeDate(-30), null); // 共通・現在有効（従レーン）
  }

  console.log(
    "Created customer selling prices (C902 × PRD860: active+common / PRD861: active unbounded / PRD862: lapsed+common / PRD863: common only / PRD865: inactive product / PRD866: 3-state+common detail)"
  );
}

/**
 * 納品先別販売単価の E2E フィクスチャを投入する（納品先 D902 × PRD87x 帯・today 相対・#548）。
 * 一覧画面の3状態（active/lapsed/none）と共通単価並記カラムの表示分岐を全て踏めるよう、
 * 上書き（納品先層）× 共通（フォールバック層）の組み合わせを商品ごとに変える:
 * - PRD870: 上書き有効・有界 `[today-30, today+30)` ¥1800 ＋ 共通 `[today-30, ∞)` ¥2000（並記の基準ケース）
 * - PRD871: 上書き有効・無期限 `[today-30, ∞)` ¥900 ＋ 共通なし（期間列 開始〜無期限・共通列空欄）
 * - PRD872: 上書き失効のみ `[today-60, today-30)` ¥1400 ＋ 共通 `[today-30, ∞)` ¥1200（失効中でも共通は生きる対比）
 * - PRD873: 上書きなし ＋ 共通 `[today-30, ∞)` ¥1100（none 行で既定価格が読めるケース）
 * - PRD874: 上書きなし ＋ 共通なし（両列空欄）
 * - PRD875: 無効商品 ＋ 上書き有効 `[today-30, today+30)` ¥700（行の無効バッジ・弾かず可視化）
 *
 * 一覧の価格解決連鎖 `納品先別 ?? 共通`（得意先別は連鎖外）に対し、一覧帯（D902×PRD87x）では並記する
 * フォールバックは共通単価のみで得意先別期間は投入しない。一方、詳細タイムラインは3段フォールバック
 * （納品先別 → 得意先別 → 共通）を3レーンで対比するため、保守帯（D904×PRD876）にのみ得意先別（親 C903）
 * 1本を併設する。seedCustomerSellingPrices と同型で、過去開始（失効）は集約の assertStartNotPast を
 * 通せないため raw daterange insert で投入する。期間行は親集約（delivery_location_selling_prices・複合PK）を
 * 先に作る。無効納品先ヘッダバッジの検証は D903（無効・上書きなし）への直接 URL で行うため上書き投入なし。
 *
 * 保守帯（#549・D904×PRD876-879）:
 * - PRD876（詳細リッチ・DB不変母体）: 納品先別 失効`[t-60,t-30)`¥1000 / 現在有効`[t-30,t+30)`¥2000 /
 *   将来`[t+30,∞)`¥3000 ＋ 得意先別（C903）現在有効`[t-30,∞)`¥2100 ＋ 共通 現在有効`[t-30,∞)`¥2200。
 *   3状態バッジ・操作出し分け・3レーンタイムライン（従レーンが得意先別・共通の両層で帯を持つ）・重複拒否母体。
 * - PRD877/878/879: 集約を作らない（上書きなし＝共通フォールバックの正常状態から開始。CRUD chain が生成）。
 */
async function seedDeliveryLocationSellingPrices(
  productIdByCode: Map<string, string>
): Promise<void> {
  const deliveryLocation = await prisma.deliveryLocation.findUniqueOrThrow({
    where: { code: "D902" },
    select: { id: true },
  });

  // 保守帯（#549）: CRUD/詳細専用納品先 D904 と、3段フォールバック中間層の親得意先 C903。
  const deliveryLocationD904 = await prisma.deliveryLocation.findUniqueOrThrow({
    where: { code: "D904" },
    select: { id: true },
  });
  const customerC903 = await prisma.customer.findUniqueOrThrow({
    where: { code: "C903" },
    select: { id: true },
  });

  const insertDeliveryLocationPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO delivery_location_selling_price_periods
        (id, delivery_location_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${deliveryLocation.id}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  // 保守帯 D904 への上書き期間 insert（宛先納品先が異なるため専用クロージャに分ける）。
  const insertD904Period = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO delivery_location_selling_price_periods
        (id, delivery_location_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${deliveryLocationD904.id}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  // 3段フォールバック中間層（得意先別・親 C903）の期間 insert。タイムライン従レーン1本用。
  const insertCustomerPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO customer_selling_price_periods
        (id, customer_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${customerC903.id}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const insertCommonPeriod = async (
    productId: string,
    price: number,
    lower: string,
    upper: string | null
  ): Promise<void> => {
    await prisma.$executeRaw`
      INSERT INTO common_selling_price_periods
        (id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        ${generateId()}::uuid,
        ${productId}::uuid,
        ${price}::numeric,
        daterange(${lower}::date, ${upper}::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
  };

  const prd870 = productIdByCode.get("PRD870");
  if (prd870) {
    await prisma.deliveryLocationSellingPrice.create({
      data: { deliveryLocationId: deliveryLocation.id, productId: prd870 },
    });
    await insertDeliveryLocationPeriod(prd870, 1800, jstRelativeDate(-30), jstRelativeDate(30)); // 上書き有効・有界
    await prisma.commonSellingPrice.create({ data: { productId: prd870 } });
    await insertCommonPeriod(prd870, 2000, jstRelativeDate(-30), null); // 共通・現在有効
  }

  const prd871 = productIdByCode.get("PRD871");
  if (prd871) {
    await prisma.deliveryLocationSellingPrice.create({
      data: { deliveryLocationId: deliveryLocation.id, productId: prd871 },
    });
    await insertDeliveryLocationPeriod(prd871, 900, jstRelativeDate(-30), null); // 上書き有効・無期限（共通なし）
  }

  const prd872 = productIdByCode.get("PRD872");
  if (prd872) {
    await prisma.deliveryLocationSellingPrice.create({
      data: { deliveryLocationId: deliveryLocation.id, productId: prd872 },
    });
    await insertDeliveryLocationPeriod(prd872, 1400, jstRelativeDate(-60), jstRelativeDate(-30)); // 上書き失効のみ
    await prisma.commonSellingPrice.create({ data: { productId: prd872 } });
    await insertCommonPeriod(prd872, 1200, jstRelativeDate(-30), null); // 共通・現在有効
  }

  const prd873 = productIdByCode.get("PRD873");
  if (prd873) {
    await prisma.commonSellingPrice.create({ data: { productId: prd873 } });
    await insertCommonPeriod(prd873, 1100, jstRelativeDate(-30), null); // 上書きなし＋共通のみ
  }

  // PRD874: 上書きなし＋共通なし（投入なし）

  const prd875 = productIdByCode.get("PRD875");
  if (prd875) {
    await prisma.deliveryLocationSellingPrice.create({
      data: { deliveryLocationId: deliveryLocation.id, productId: prd875 },
    });
    await insertDeliveryLocationPeriod(prd875, 700, jstRelativeDate(-30), jstRelativeDate(30)); // 無効商品＋上書き有効
  }

  // PRD876: 詳細（管理画面）閲覧系・重複拒否母体（#549）。D904 に失効/現在有効/将来の3状態上書き。
  // 加えて得意先別（C903）現在有効1本・共通 現在有効1本を併設し、タイムライン主レーン bar 3 本・
  // 従レーン secondary-bar 2 本（得意先別1・共通1）＝3段フォールバック全埋めを作る。
  const prd876 = productIdByCode.get("PRD876");
  if (prd876) {
    await prisma.deliveryLocationSellingPrice.create({
      data: { deliveryLocationId: deliveryLocationD904.id, productId: prd876 },
    });
    await insertD904Period(prd876, 1000, jstRelativeDate(-60), jstRelativeDate(-30)); // 納品先別・失効
    await insertD904Period(prd876, 2000, jstRelativeDate(-30), jstRelativeDate(30)); // 納品先別・現在有効
    await insertD904Period(prd876, 3000, jstRelativeDate(30), null); // 納品先別・将来（無期限）
    await prisma.customerSellingPrice.create({
      data: { customerId: customerC903.id, productId: prd876 },
    });
    await insertCustomerPeriod(prd876, 2100, jstRelativeDate(-30), null); // 得意先別・現在有効（従レーン中間層）
    await prisma.commonSellingPrice.create({ data: { productId: prd876 } });
    await insertCommonPeriod(prd876, 2200, jstRelativeDate(-30), null); // 共通・現在有効（従レーン最下層）
  }

  // PRD877/878/879: CRUD Chain A/B/C 用。上書き集約を作らない（上書きなし＝共通フォールバックの
  // 正常状態から開始し、テスト内で登録→編集→適用終了→改定→削除する）。

  console.log(
    "Created delivery location selling prices (D902 × PRD870: active+common / PRD871: active unbounded / PRD872: lapsed+common / PRD873: common only / PRD875: inactive product | D904 × PRD876: 3-state + customer + common fallback)"
  );
}

// 消費税率マスタ（§8.7 の保存時税率一致チェックが参照）。8%(2014-) / 10%(2019-)。
const TAX_RATES = [
  { rate: "0.080", effectiveFrom: new Date("2014-04-01T00:00:00+09:00") },
  { rate: "0.100", effectiveFrom: new Date("2019-10-01T00:00:00+09:00") },
];

// --- ヘルパー関数 ---

function generateEmployeeCd(index: number): string {
  return `EMP${String(index).padStart(6, "0")}`;
}

function generateEmail(index: number): string {
  return `employee${index}@example.com`;
}

interface SeedUser {
  employeeCd: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string;
  superiorRoleId: string | null;
  assignedRoleId?: string;
}

function generateSeedUsers(
  roleIdMap: Map<string, string>,
  departmentIdMap: Map<string, string>
): SeedUser[] {
  const users: SeedUser[] = [];
  const totalEmployees = ROLE_EMPLOYEE_CONFIGS.length + GENERAL_EMPLOYEES.length;

  for (let i = 1; i <= totalEmployees; i++) {
    if (i <= ROLE_EMPLOYEE_CONFIGS.length) {
      // 役割を持つ従業員（最初の2名は固定ユーザー）
      const config = ROLE_EMPLOYEE_CONFIGS[i - 1];
      const isFixedUser = i <= FIXED_USERS.length;
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: EMPLOYEE_NAMES[i - 1],
        role: isFixedUser ? FIXED_USERS[i - 1].role : USER_ROLES.USER,
        departmentId: departmentIdMap.get(config.departmentCd)!,
        // 役割持ちは上位役割を担当役割から導出するため明示行を持たない（I1・ADR-20260707-k4e）
        superiorRoleId: null,
        assignedRoleId: roleIdMap.get(config.roleCd),
      });
    } else {
      // 一般従業員
      const generalIndex = i - ROLE_EMPLOYEE_CONFIGS.length - 1;
      const config = GENERAL_EMPLOYEES[generalIndex];
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: EMPLOYEE_NAMES[i - 1],
        role: USER_ROLES.USER,
        departmentId: departmentIdMap.get(config.departmentCd)!,
        superiorRoleId: roleIdMap.get(config.superiorRoleCd)!,
      });
    }
  }
  return users;
}

async function createUserWithEmployee(userData: SeedUser, hashedPassword: string) {
  const employeeId = generateId();
  const userId = generateId();
  const accountId = generateId();

  // 課員（担当役割なし）のみ明示上位役割行を作る。役割持ちは担当役割から導出するため
  // 明示行を持たない（I1・ADR-20260707-k4e）。上位役割は列ではなく子表 EmployeeSuperiorRole。
  const shouldSetExplicitSuperior = !userData.assignedRoleId && userData.superiorRoleId != null;

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        id: employeeId,
        employeeCd: userData.employeeCd,
        email: userData.email,
        name: userData.name,
        departmentId: userData.departmentId,
        superiorRole: shouldSetExplicitSuperior
          ? { create: { roleId: userData.superiorRoleId! } }
          : undefined,
      },
    });

    const user = await tx.user.create({
      data: {
        id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: true,
        employeeId: employeeId,
        role: userData.role,
      },
    });

    await tx.account.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
      },
    });

    return { employee, user };
  });

  return result;
}

async function seedCustomersAndDeliveryLocations() {
  let customerCount = 0;
  let deliveryLocationCount = 0;

  for (const customerData of CUSTOMERS) {
    const customerId = generateId();

    await prisma.customer.create({
      data: {
        id: customerId,
        code: customerData.code,
        name: customerData.name,
        postalCode: customerData.postalCode,
        prefecture: customerData.prefecture,
        address: customerData.address,
        phoneNumber: customerData.phoneNumber,
        faxNumber: customerData.faxNumber,
        contactPerson: customerData.contactPerson,
        isActive: customerData.isActive ?? true,
      },
    });

    customerCount++;

    for (const dlData of customerData.deliveryLocations) {
      const dlId = generateId();

      await prisma.deliveryLocation.create({
        data: {
          id: dlId,
          code: dlData.code,
          name: dlData.name,
          postalCode: dlData.postalCode,
          prefecture: dlData.prefecture,
          address: dlData.address,
          phoneNumber: dlData.phoneNumber,
          faxNumber: null,
          contactPerson: null,
          isActive: (dlData as { isActive?: boolean }).isActive ?? true,
          customerId: customerId,
          deliveryNotes: dlData.deliveryNotes,
        },
      });

      deliveryLocationCount++;
    }
  }

  return { customerCount, deliveryLocationCount };
}

// --- メイン処理 ---

async function main() {
  console.log("E2E seed: Start seeding...");
  console.log("");

  // 既存データを削除（FK制約を考慮した順序）
  // 見積は得意先・納品先・部署・従業員・商品を参照する（onDelete: Restrict）ため、
  // それらの削除より先に消す。配下（variation/item/setGroup 等）は Cascade で連鎖削除される。
  // 見積申請系（#572）は全 FK が Restrict のため、estimate 削除前に子→親順で消す。
  await prisma.estimateStepApproval.deleteMany();
  await prisma.estimateStepRejection.deleteMany();
  await prisma.estimateApprovalStep.deleteMany();
  await prisma.estimateApplicationWithdrawal.deleteMany();
  await prisma.estimateApprovalExemption.deleteMany();
  await prisma.estimateApplication.deleteMany();
  await prisma.estimateVariationCopy.deleteMany();
  await prisma.estimateVariationRevision.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.taxRate.deleteMany();
  await prisma.setProductComponent.deleteMany();
  await prisma.productRelation.deleteMany();
  await prisma.costPrice.deleteMany(); // 原価集約。期間行は FK Cascade で消える（ADR-20260627-a5c）
  await prisma.product.deleteMany();
  await prisma.deliveryLocation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employeeRole.deleteMany();
  await prisma.employeeSuperiorRole.deleteMany(); // 課員の明示上位役割（ADR-20260707-k4e）
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  console.log("Cleared existing data");

  // 部署を作成
  const departmentIdMap = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const id = generateId();
    departmentIdMap.set(dept.departmentCd, id);
    await prisma.department.create({
      data: {
        id,
        departmentCd: dept.departmentCd,
        name: dept.name,
        abbreviation: dept.abbreviation,
        isActive: true,
      },
    });
  }
  console.log(`Created ${DEPARTMENTS.length} departments`);

  // E2E専用部署を作成（DEPT9NN 帯）
  for (const dept of E2E_ONLY_DEPARTMENTS) {
    const id = generateId();
    departmentIdMap.set(dept.departmentCd, id);
    await prisma.department.create({
      data: {
        id,
        departmentCd: dept.departmentCd,
        name: dept.name,
        abbreviation: dept.abbreviation,
        isActive: true,
        parentId: dept.parentDepartmentCd
          ? (departmentIdMap.get(dept.parentDepartmentCd) ?? null)
          : null,
      },
    });
  }
  console.log(`Created ${E2E_ONLY_DEPARTMENTS.length} E2E-only departments`);

  // 役職を作成（上位から作成でFK制約を満たす）
  const positionIdMap = new Map<string, string>();
  const positionsOrdered = [...POSITIONS].reverse();
  for (const pos of positionsOrdered) {
    const id = generateId();
    positionIdMap.set(pos.cd, id);
    await prisma.position.create({
      data: {
        id,
        positionCd: pos.cd,
        name: pos.name,
        superiorPositionId: pos.superiorCd ? (positionIdMap.get(pos.superiorCd) ?? null) : null,
      },
    });
  }
  console.log(`Created ${POSITIONS.length} positions`);

  // 役割を作成
  const roleIdMap = new Map<string, string>();
  for (const role of ROLES) {
    const id = generateId();
    roleIdMap.set(role.cd, id);
    await prisma.role.create({
      data: {
        id,
        roleCd: role.cd,
        name: role.name,
        positionId: positionIdMap.get(role.positionCd)!,
        superiorRoleId: role.superiorCd ? (roleIdMap.get(role.superiorCd) ?? null) : null,
      },
    });
  }
  console.log(`Created ${ROLES.length} roles`);

  // E2E専用役割を作成（ROLE9NN 帯）
  for (const role of E2E_ONLY_ROLES) {
    const id = generateId();
    roleIdMap.set(role.cd, id);
    await prisma.role.create({
      data: {
        id,
        roleCd: role.cd,
        name: role.name,
        positionId: positionIdMap.get(role.positionCd)!,
        superiorRoleId: role.superiorCd ? (roleIdMap.get(role.superiorCd) ?? null) : null,
      },
    });
  }
  console.log(`Created ${E2E_ONLY_ROLES.length} E2E-only roles`);

  // 得意先・納品先を作成
  const { customerCount, deliveryLocationCount } = await seedCustomersAndDeliveryLocations();
  console.log(`Created ${customerCount} customers, ${deliveryLocationCount} delivery locations`);

  // 商品を作成
  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: {
        id: generateId(),
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        isActive: product.isActive,
        description: product.description,
      },
    });
  }
  console.log(`Created ${PRODUCTS.length} products`);

  // 原価集約（ADR-0066 / 0067 / 20260627-a5c）。別 curated 配列を作らず PRODUCTS から導出し、
  // バックフィル移行と同じカテゴリ分岐・同じ起点（2026-04-01）で投入する（seed と移行の意味論ドリフトを防ぐ）。
  // 非複合品 ＆ costPrice 非null のみ親＋期間 [2026-04-01, ) を1本生成する（複合品・null は作らない）。
  const COST_PRICE_BASE_DATE = "2026-04-01";
  const productIdByCode = new Map(
    (await prisma.product.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id])
  );
  let e2eCostCount = 0;
  for (const product of PRODUCTS) {
    if (product.category === "SET" || product.costPrice == null) continue;
    const productId = productIdByCode.get(product.code);
    if (!productId) continue;
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
    e2eCostCount += 1;
  }
  console.log(`Created cost prices (${e2eCostCount} products / periods)`);

  // 共通販売単価 保守 E2E フィクスチャ（PRD82x 帯・#481・ADR-20260629-3x5）。
  // 状態（future/active/expired）はサーバの参照日由来の派生のため、固定日付では実行日によって
  // 状態が変わってテストが壊れる。シードもテストも「実行時の今日（JST 暦日）」起点の相対日付で
  // 期間を作り、状態を決定的に再現する。過去開始（expired）は集約の assertStartNotPast を通せない
  // ため、業務操作経路ではなく raw daterange insert で投入する。
  await seedCommonSellingPrices(productIdByCode);

  // 原価 一覧 E2E フィクスチャ（PRD84x 帯・#501・ADR-20260629-3x5）。3状態（active/lapsed/unset）は
  // 参照日由来の派生状態で、読みモデル SQL（daterange @> 参照日）の正しさはユニットでは検証できない
  // ため today 相対で投入する。既存 PRD82x 帯（原価集約なし前提の CSP フィクスチャ）には触れない。
  await seedCostPrices(productIdByCode);

  // 得意先別販売単価 一覧 E2E フィクスチャ（C902 × PRD86x 帯・#508・ADR-20260629-3x5）。
  // 3状態（active/lapsed/none）は参照日由来の派生状態のため today 相対で投入する。
  // 専用得意先 C902 に閉じるため、既存の得意先・商品フィクスチャには影響しない。
  await seedCustomerSellingPrices(productIdByCode);

  // 納品先別販売単価 一覧 E2E フィクスチャ（D902 × PRD87x 帯・#548・ADR-20260629-3x5）。
  // 3状態（active/lapsed/none）は参照日由来の派生状態のため today 相対で投入する。
  // 専用得意先 C903・専用納品先 D902 に閉じるため、既存フィクスチャには影響しない。
  await seedDeliveryLocationSellingPrices(productIdByCode);

  // S4 周辺商品サジェスト E2E 用の関連（本体 PRD810 → 周辺 PRD811・数量2）。
  const suggestParent = await prisma.product.findUniqueOrThrow({ where: { code: "PRD810" } });
  const suggestRelated = await prisma.product.findUniqueOrThrow({ where: { code: "PRD811" } });
  await prisma.productRelation.create({
    data: {
      productId: suggestParent.id,
      relatedProductId: suggestRelated.id,
      quantity: 2,
    },
  });

  // S5 セット構成（SetProductComponent・ADR-0047）。SET 商品 PRD005 = 標準デスク + オフィスチェア。
  // 自動展開（expandSetComponents）が構成を引けるようにする（E2E のセット追加フロー）。
  const setProduct = await prisma.product.findUniqueOrThrow({ where: { code: "PRD005" } });
  const deskComponent = await prisma.product.findUniqueOrThrow({ where: { code: "PRD001" } });
  const chairComponent = await prisma.product.findUniqueOrThrow({ where: { code: "PRD002" } });
  await prisma.setProductComponent.createMany({
    data: [
      { setProductId: setProduct.id, componentProductId: deskComponent.id, quantity: 1 },
      { setProductId: setProduct.id, componentProductId: chairComponent.id, quantity: 1 },
    ],
  });

  // 消費税率マスタを作成（§8.7 の保存時税率一致チェックが参照する）。
  // 8%(2014-04-01〜) / 10%(2019-10-01〜)。見積編集（C2）の税率解決に必須。
  for (const tr of TAX_RATES) {
    await prisma.taxRate.create({
      data: { id: generateId(), rate: tr.rate, effectiveFrom: tr.effectiveFrom },
    });
  }
  console.log(`Created ${TAX_RATES.length} tax rates`);

  // パスワードハッシュ化
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // ユーザー・従業員を作成
  const users = generateSeedUsers(roleIdMap, departmentIdMap);
  const employeeRoleData: { employeeId: string; roleId: string }[] = [];

  for (const userData of users) {
    const { employee } = await createUserWithEmployee(userData, hashedPassword);
    if (userData.assignedRoleId) {
      employeeRoleData.push({ employeeId: employee.id, roleId: userData.assignedRoleId });
    }
  }
  console.log(`Created ${users.length} employees`);

  // 従業員役割を作成
  for (const data of employeeRoleData) {
    await prisma.employeeRole.create({ data });
  }
  console.log(`Created ${employeeRoleData.length} employee role assignments`);

  // E2E専用従業員を作成（ROLE9NN 帯の役割を「使用中」にするため）
  for (const e2eEmp of E2E_ONLY_EMPLOYEES) {
    const { employee } = await createUserWithEmployee(
      {
        employeeCd: e2eEmp.employeeCd,
        email: e2eEmp.email,
        name: e2eEmp.name,
        role: USER_ROLES.USER,
        departmentId: departmentIdMap.get(e2eEmp.departmentCd)!,
        // ROLE903 を担当役割に持つ役割持ちのため、上位役割は導出（明示行を作らない・I1）。
        // 旧 superiorRoleCd は廃止列専用だったため参照しない。ROLE903 の使用中は EmployeeRole が担保。
        superiorRoleId: null,
      },
      hashedPassword
    );
    await prisma.employeeRole.create({
      data: { employeeId: employee.id, roleId: roleIdMap.get(e2eEmp.assignedRoleCd)! },
    });
  }
  console.log(`Created ${E2E_ONLY_EMPLOYEES.length} E2E-only employees`);

  // 見積（#330 / S2 閲覧画面のデモ・E2E 用）。マスタ作成後に参照して作る。
  const estimateCount = await seedEstimates(prisma);
  console.log(`Created ${estimateCount} estimates`);

  // 見積申請一覧（#572）の代表フィクスチャ（PENDING/APPROVED/EXEMPTED/WITHDRAWN+INACTIVE）。
  const applicationEstimateCount = await seedEstimateApplications(prisma);
  console.log(`Created ${applicationEstimateCount} estimate applications`);

  console.log("");
  console.log("=".repeat(50));
  console.log("E2E seed finished.");
  console.log(
    `  Departments: ${DEPARTMENTS.length + E2E_ONLY_DEPARTMENTS.length} (incl. ${E2E_ONLY_DEPARTMENTS.length} E2E-only)`
  );
  console.log(`  Positions: ${POSITIONS.length}`);
  console.log(
    `  Roles: ${ROLES.length + E2E_ONLY_ROLES.length} (incl. ${E2E_ONLY_ROLES.length} E2E-only)`
  );
  console.log(
    `  Employees: ${users.length + E2E_ONLY_EMPLOYEES.length} (incl. ${E2E_ONLY_EMPLOYEES.length} E2E-only)`
  );
  console.log(`  Products: ${PRODUCTS.length}`);
  console.log(`  Customers: ${customerCount}`);
  console.log(`  Delivery locations: ${deliveryLocationCount}`);
  console.log(`  Password: ${DEFAULT_PASSWORD}`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
