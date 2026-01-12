import { createId } from "@paralleldrive/cuid2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../generated/prisma/client";
import type { UserRole } from "../src/server/shared/auth/types";
import { USER_ROLES } from "../src/server/shared/auth/types";

config({ path: ".env" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// デフォルトパスワード（開発環境用）
const DEFAULT_PASSWORD = "pass123!";

// 生成する従業員数
const TOTAL_EMPLOYEES = 2000;
// 管理者の割合（約5%）
const ADMIN_RATIO = 0.05;
// バッチサイズ（進捗表示用）
const BATCH_SIZE = 100;

// 日本人の姓リスト
const LAST_NAMES = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水",
  "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川",
  "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本",
  "斉藤", "福田", "太田", "西村", "藤井", "金子", "三浦", "藤原", "岡本", "松田",
];

// 日本人の名リスト
const FIRST_NAMES = [
  "太郎", "次郎", "三郎", "一郎", "健太", "翔太", "大輝", "拓也", "直樹", "和也",
  "花子", "愛子", "美咲", "さくら", "陽子", "恵子", "真由美", "裕子", "智子", "由美",
  "大介", "健一", "誠", "隆", "浩", "剛", "修", "亮", "学", "豊",
  "麻衣", "彩", "舞", "遥", "凛", "葵", "結衣", "美優", "楓", "桃子",
  "翔", "蓮", "悠真", "颯太", "湊", "陽翔", "朝陽", "結翔", "悠斗", "駿",
];

interface SeedUser {
  employeeCd: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string;
}

// 部署リスト
const DEPARTMENTS = [
  { id: "dept-001", departmentCd: "DEPT001", name: "営業部", abbreviation: "営業", displayOrder: 1 },
  { id: "dept-002", departmentCd: "DEPT002", name: "開発部", abbreviation: "開発", displayOrder: 2 },
  { id: "dept-003", departmentCd: "DEPT003", name: "総務部", abbreviation: "総務", displayOrder: 3 },
  { id: "dept-004", departmentCd: "DEPT004", name: "人事部", abbreviation: "人事", displayOrder: 4 },
  { id: "dept-005", departmentCd: "DEPT005", name: "経理部", abbreviation: "経理", displayOrder: 5 },
];

// ランダムな要素を取得
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// 従業員コードを生成（EMP000001形式）
function generateEmployeeCd(index: number): string {
  return `EMP${String(index).padStart(6, "0")}`;
}

// ランダムな名前を生成
function generateName(): string {
  const lastName = randomChoice(LAST_NAMES);
  const firstName = randomChoice(FIRST_NAMES);
  return `${lastName} ${firstName}`;
}

// メールアドレスを生成
function generateEmail(index: number): string {
  return `employee${index}@example.com`;
}

// 役割を決定（約5%が管理者）
function determineRole(index: number): UserRole {
  // 最初の1人は必ず管理者
  if (index === 1) return USER_ROLES.ADMIN;
  // それ以降は確率で決定
  return Math.random() < ADMIN_RATIO ? USER_ROLES.ADMIN : USER_ROLES.USER;
}

// シードユーザーデータを生成
function generateSeedUsers(count: number): SeedUser[] {
  const users: SeedUser[] = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      employeeCd: generateEmployeeCd(i),
      email: generateEmail(i),
      name: generateName(),
      role: determineRole(i),
      departmentId: randomChoice(DEPARTMENTS).id,
    });
  }
  return users;
}

async function createUserWithEmployee(
  userData: SeedUser,
  hashedPassword: string
) {
  const employeeId = createId();
  const userId = createId();
  const accountId = createId();

  // トランザクションでEmployee, User, Accountを一括作成
  const result = await prisma.$transaction(async (tx) => {
    // 1. Employeeを作成
    const employee = await tx.employee.create({
      data: {
        id: employeeId,
        employeeCd: userData.employeeCd,
        email: userData.email,
        name: userData.name,
        departmentId: userData.departmentId,
      },
    });

    // 2. Userを作成（Employeeとリンク）
    const user = await tx.user.create({
      data: {
        id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: true, // 開発環境では検証済みとして扱う
        employeeId: employeeId,
        role: userData.role, // Admin Pluginで使用する権限
      },
    });

    // 3. Accountを作成（ハッシュ化されたパスワードで）
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

async function main() {
  console.log("Start seeding...");
  console.log(`Generating ${TOTAL_EMPLOYEES} employees...`);
  console.log("");

  // 既存データを削除（外部キー制約を考慮した順序）
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  console.log("Deleted existing data");
  console.log("");

  // 部署を作成
  console.log("Creating departments...");
  for (const dept of DEPARTMENTS) {
    await prisma.department.create({
      data: {
        id: dept.id,
        departmentCd: dept.departmentCd,
        name: dept.name,
        abbreviation: dept.abbreviation,
        displayOrder: dept.displayOrder,
        isActive: true,
      },
    });
  }
  console.log(`Created ${DEPARTMENTS.length} departments`);
  console.log("");

  // パスワードは全員同じなので、事前に1回だけハッシュ化
  console.log("Hashing password...");
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  console.log("Password hashed");
  console.log("");

  // ユーザーデータを生成
  const users = generateSeedUsers(TOTAL_EMPLOYEES);
  let adminCount = 0;
  let userCount = 0;

  // 各ユーザーを作成（バッチごとに進捗表示）
  console.log("Creating users...");
  const startTime = Date.now();

  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    await createUserWithEmployee(userData, hashedPassword);

    if (userData.role === USER_ROLES.ADMIN) {
      adminCount++;
    } else {
      userCount++;
    }

    // 進捗表示（バッチサイズごと、または最後）
    if ((i + 1) % BATCH_SIZE === 0 || i + 1 === users.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = (((i + 1) / users.length) * 100).toFixed(1);
      process.stdout.write(
        `\r  Progress: ${i + 1}/${users.length} (${percent}%) - ${elapsed}s elapsed`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log("");
  console.log("=".repeat(50));
  console.log("Seeding finished.");
  console.log(`Total time: ${totalTime}s`);
  console.log(`Created ${TOTAL_EMPLOYEES} employees:`);
  console.log(`  - Admins: ${adminCount}`);
  console.log(`  - Users: ${userCount}`);
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
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
