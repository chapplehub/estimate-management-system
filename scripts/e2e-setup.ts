/**
 * E2Eテスト環境セットアップスクリプト
 *
 * 1. テスト用DBの存在チェック + 自動作成
 * 2. Prismaマイグレーション適用
 * 3. E2E専用シードデータ投入
 *
 * 使い方: pnpm e2e:setup
 */
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";

const ENV_TEST_PATH = path.resolve(__dirname, "../.env.test");

if (!existsSync(ENV_TEST_PATH)) {
  console.error("Error: .env.test が見つかりません。");
  console.error("以下のコマンドでテンプレートからコピーしてください:");
  console.error("  cp .env.test.example .env.test");
  process.exit(1);
}

config({ path: ENV_TEST_PATH });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Error: .env.test に DATABASE_URL が設定されていません。");
  process.exit(1);
}

// DATABASE_URLからDB名を抽出
function extractDbName(url: string): string {
  const match = url.match(/\/([^/?]+)(\?.*)?$/);
  if (!match) {
    console.error("Error: DATABASE_URL からデータベース名を抽出できません。");
    process.exit(1);
  }
  return match[1];
}

const dbName = extractDbName(databaseUrl);

console.log("=".repeat(50));
console.log("E2E Test Environment Setup");
console.log("=".repeat(50));
console.log(`Database: ${dbName}`);
console.log("");

// Step 1: DB作成
console.log("[1/3] Checking database...");
try {
  execFileSync("createdb", [dbName], { stdio: "pipe" });
  console.log(`  Created database: ${dbName}`);
} catch (e: unknown) {
  const error = e as { stderr?: Buffer };
  const stderr = error.stderr?.toString() ?? "";
  if (stderr.includes("already exists")) {
    console.log(`  Database already exists: ${dbName}`);
  } else {
    console.error(`  Failed to create database: ${stderr}`);
    process.exit(1);
  }
}

// Step 2: マイグレーション
console.log("");
console.log("[2/3] Running migrations...");
try {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("  Migrations applied.");
} catch {
  console.error("  Failed to apply migrations.");
  process.exit(1);
}

// Step 3: シード
console.log("");
console.log("[3/3] Seeding database...");
try {
  execFileSync("tsx", ["prisma/seed-e2e.ts"], {
    stdio: "inherit",
    env: { ...process.env },
  });
} catch {
  console.error("  Failed to seed database.");
  process.exit(1);
}

console.log("");
console.log("=".repeat(50));
console.log("E2E setup complete!");
console.log("  Run tests: pnpm e2e");
console.log("  UI mode:   pnpm e2e:ui");
console.log("=".repeat(50));
