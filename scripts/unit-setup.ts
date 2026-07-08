/**
 * 単体テスト（vitest）環境セットアップスクリプト
 *
 * 1. 単体テスト用DBの存在チェック + 自動作成
 * 2. Prismaマイグレーション適用
 * 3. 単体テスト用シードデータ投入（正準マスタのみ）
 *
 * 使い方: pnpm test:setup
 *
 * e2e-setup.ts（.env.test / seed-e2e.ts）の型を単体テストへ横展開したもの（Issue #584）。
 */
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";

const ENV_UNIT_PATH = path.resolve(__dirname, "../.env.unit");

if (!existsSync(ENV_UNIT_PATH)) {
  console.error("Error: .env.unit が見つかりません。");
  console.error("以下のコマンドでテンプレートからコピーしてください:");
  console.error("  cp .env.unit.example .env.unit");
  process.exit(1);
}

config({ path: ENV_UNIT_PATH });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Error: .env.unit に DATABASE_URL が設定されていません。");
  process.exit(1);
}

// DATABASE_URLから接続情報を抽出
function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port || "5432",
    user: parsed.username,
    password: parsed.password,
    dbName: decodeURIComponent(parsed.pathname.slice(1)), // 先頭の "/" を除去
  };
}

const dbInfo = parseDatabaseUrl(databaseUrl);

console.log("=".repeat(50));
console.log("Unit Test Environment Setup");
console.log("=".repeat(50));
console.log(`Database: ${dbInfo.dbName}`);
console.log(`Host:     ${dbInfo.host}:${dbInfo.port}`);
console.log(`User:     ${dbInfo.user}`);
console.log("");

// Step 1: DB作成
console.log("[1/3] Checking database...");
try {
  execFileSync(
    "createdb",
    ["-h", dbInfo.host, "-p", dbInfo.port, "-U", dbInfo.user, dbInfo.dbName],
    { stdio: "pipe", env: { ...process.env, PGPASSWORD: dbInfo.password } },
  );
  console.log(`  Created database: ${dbInfo.dbName}`);
} catch (e: unknown) {
  const error = e as { stderr?: Buffer };
  const stderr = error.stderr?.toString() ?? "";
  if (stderr.includes("already exists")) {
    console.log(`  Database already exists: ${dbInfo.dbName}`);
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
  execFileSync("tsx", ["prisma/seed-unit.ts"], {
    stdio: "inherit",
    env: { ...process.env },
  });
} catch {
  console.error("  Failed to seed database.");
  process.exit(1);
}

console.log("");
console.log("=".repeat(50));
console.log("Unit test setup complete!");
console.log("  Run tests: pnpm test");
console.log("=".repeat(50));
