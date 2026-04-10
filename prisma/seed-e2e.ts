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
    marginRate: 10,
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
    marginRate: 15,
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
    marginRate: 12,
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
    const companyId = generateId();
    const customerId = generateId();

    await prisma.$transaction(async (tx) => {
      await tx.company.create({
        data: {
          id: companyId,
          code: customerData.code,
          name: customerData.name,
          type: "CUSTOMER",
          postalCode: customerData.postalCode,
          prefecture: customerData.prefecture,
          address: customerData.address,
          phoneNumber: customerData.phoneNumber,
          faxNumber: customerData.faxNumber,
          contactPerson: customerData.contactPerson,
          isActive: true,
        },
      });

      await tx.customer.create({
        data: {
          id: customerId,
          companyId: companyId,
          marginRate: customerData.marginRate,
        },
      });
    });

    customerCount++;

    for (const dlData of customerData.deliveryLocations) {
      const dlCompanyId = generateId();
      const dlId = generateId();

      await prisma.$transaction(async (tx) => {
        await tx.company.create({
          data: {
            id: dlCompanyId,
            code: dlData.code,
            name: dlData.name,
            type: "DELIVERY_LOCATION",
            postalCode: dlData.postalCode,
            prefecture: dlData.prefecture,
            address: dlData.address,
            phoneNumber: dlData.phoneNumber,
            faxNumber: null,
            contactPerson: null,
            isActive: true,
          },
        });

        await tx.deliveryLocation.create({
          data: {
            id: dlId,
            companyId: dlCompanyId,
            customerId: customerId,
            deliveryNotes: dlData.deliveryNotes,
          },
        });
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
  await prisma.setProductComponent.deleteMany();
  await prisma.productRelation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.deliveryLocation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.company.deleteMany();
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
        costPrice: product.costPrice,
        isActive: product.isActive,
        description: product.description,
      },
    });
  }
  console.log(`Created ${PRODUCTS.length} products`);

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

  console.log("");
  console.log("=".repeat(50));
  console.log("E2E seed finished.");
  console.log(`  Departments: ${DEPARTMENTS.length}`);
  console.log(`  Positions: ${POSITIONS.length}`);
  console.log(`  Roles: ${ROLES.length}`);
  console.log(`  Employees: ${users.length}`);
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
