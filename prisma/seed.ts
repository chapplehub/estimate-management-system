import { createId } from "@paralleldrive/cuid2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../generated/prisma/client";

config({ path: ".env" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// デフォルトパスワード（開発環境用）
const DEFAULT_PASSWORD = "pass123!";

interface SeedUser {
  employeeCd: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
}

async function createUserWithEmployee(userData: SeedUser) {
  const employeeId = createId();
  const userId = createId();
  const accountId = createId();
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // トランザクションでEmployee, User, Accountを一括作成
  const result = await prisma.$transaction(async (tx) => {
    // 1. Employeeを作成
    const employee = await tx.employee.create({
      data: {
        id: employeeId,
        employeeCd: userData.employeeCd,
        email: userData.email,
        name: userData.name,
        role: userData.role,
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

  // 既存データを削除（外部キー制約を考慮した順序）
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  console.log("Deleted existing data");

  // ユーザーデータ
  const users: SeedUser[] = [
    {
      employeeCd: "EMP000001",
      email: "admin@example.com",
      name: "Admin Taro",
      role: "ADMIN",
    },
    {
      employeeCd: "EMP000002",
      email: "yamada@example.com",
      name: "Yamada Hanako",
      role: "USER",
    },
    {
      employeeCd: "EMP000003",
      email: "tanaka@example.com",
      name: "Tanaka Ichiro",
      role: "USER",
    },
    {
      employeeCd: "EMP000004",
      email: "suzuki@example.com",
      name: "Suzuki Jiro",
      role: "USER",
    },
    {
      employeeCd: "EMP000005",
      email: "sato@example.com",
      name: "Sato Saburo",
      role: "USER",
    },
  ];

  // 各ユーザーを作成
  for (const userData of users) {
    const { employee, user } = await createUserWithEmployee(userData);
    console.log(
      `Created: ${employee.name} (${employee.employeeCd}) - User ID: ${user.id}`
    );
  }

  console.log("");
  console.log("=".repeat(50));
  console.log("Seeding finished.");
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
