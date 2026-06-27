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
    superiorRoleCd: "ROLE003",
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

// 一般従業員（EMP000006〜EMP000020）の部署割り当て
const GENERAL_EMPLOYEES = [
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT001", superiorRoleCd: "ROLE005" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE004" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE004" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE004" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE004" },
  { departmentCd: "DEPT002", superiorRoleCd: "ROLE004" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE003" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE003" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE003" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE003" },
  { departmentCd: "DEPT003", superiorRoleCd: "ROLE003" },
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
];

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
      const assignedRole = ROLES.find((r) => r.cd === config.roleCd)!;
      const superiorRoleId = assignedRole.superiorCd
        ? roleIdMap.get(assignedRole.superiorCd)!
        : null;
      const isFixedUser = i <= FIXED_USERS.length;
      users.push({
        employeeCd: generateEmployeeCd(i),
        email: generateEmail(i),
        name: EMPLOYEE_NAMES[i - 1],
        role: isFixedUser ? FIXED_USERS[i - 1].role : USER_ROLES.USER,
        departmentId: departmentIdMap.get(config.departmentCd)!,
        superiorRoleId,
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

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        id: employeeId,
        employeeCd: userData.employeeCd,
        email: userData.email,
        name: userData.name,
        departmentId: userData.departmentId,
        superiorRoleId: userData.superiorRoleId,
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
        superiorRoleId: roleIdMap.get(e2eEmp.superiorRoleCd)!,
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
