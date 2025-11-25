import * as argon2 from "argon2";
import { PrismaClient } from "../generated/prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";

// Load .env.local for development
config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // Delete existing employees
  await prisma.employee.deleteMany();
  console.log("Deleted existing employees");

  // Hash password
  const passwordHash = await argon2.hash("password123");

  // Create admin user
  const admin = await prisma.employee.create({
    data: {
      id: createId(),
      employeeCd: "EMP000001",
      email: "admin@example.com",
      name: "Admin Taro",
      passwordHash,
      role: "ADMIN",
      failedLoginAttempts: 0,
    },
  });
  console.log(`Created admin: ${admin.name} (${admin.employeeCd})`);

  // Create regular users
  const users = [
    {
      employeeCd: "EMP000002",
      email: "yamada@example.com",
      name: "Yamada Hanako",
      role: "USER" as const,
    },
    {
      employeeCd: "EMP000003",
      email: "tanaka@example.com",
      name: "Tanaka Ichiro",
      role: "USER" as const,
    },
    {
      employeeCd: "EMP000004",
      email: "suzuki@example.com",
      name: "Suzuki Jiro",
      role: "USER" as const,
    },
    {
      employeeCd: "EMP000005",
      email: "sato@example.com",
      name: "Sato Saburo",
      role: "USER" as const,
    },
  ];

  for (const userData of users) {
    const user = await prisma.employee.create({
      data: {
        id: createId(),
        ...userData,
        passwordHash,
        failedLoginAttempts: 0,
      },
    });
    console.log(`Created user: ${user.name} (${user.employeeCd})`);
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
