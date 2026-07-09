/**
 * 単体テスト（vitest）専用シードデータ
 *
 * 単体テストが seed に要求するのは正準マスタ（役職 POS001-004 / 役割 ROLE001-015 / 消費税率）のみ。
 * シナリオデータ（部署・従業員・得意先・商品・価格）は各テストが ensure*Fixtures ヘルパーや
 * 予約コード帯で自前生成するため、ここでは投入しない（Issue #584・開発 seed から構造的に独立させる）。
 *
 * 冪等性: 全マスタを positionCd / roleCd / effectiveFrom（いずれも @unique）で upsert する。
 * deleteMany では EmployeeRole → Role の Restrict FK により、テストが残した従業員が役割を参照している
 * 場合に削除が失敗しうる。upsert なら leftover のシナリオ行を壊さず値だけ最新化できる。
 *
 * 接続先は .env.unit の DATABASE_URL（単体テスト専用DB）。vitest.config.ts と同じ env を読む。
 */
import { generateId } from "../src/server/shared/generateId";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { existsSync } from "fs";
import path from "path";
import { PrismaClient } from "../generated/prisma/client";
import { POSITIONS, TAX_RATES } from "./seed-shared/masterData";

// .env.unit は単体テスト専用DBの接続先。未整備のまま `pnpm test`（seed-unit → vitest）を走らせると
// DATABASE_URL 不在で PrismaPg の低レベル接続エラーになり原因が分かりにくいため、unit-setup.ts と同じ
// existsSync ガードを前段に置き cp 誘導を出す（Issue #584 フォローアップ）。__dirname 基準にすることで
// 実行 cwd に依存せず prisma/ の親（ルート）の .env.unit を確実に指す。
const ENV_UNIT_PATH = path.resolve(__dirname, "../.env.unit");

if (!existsSync(ENV_UNIT_PATH)) {
  console.error("Error: .env.unit が見つかりません。");
  console.error("以下のコマンドでテンプレートからコピーしてください:");
  console.error("  cp .env.unit.example .env.unit");
  process.exit(1);
}

config({ path: ENV_UNIT_PATH });

if (!process.env.DATABASE_URL) {
  console.error("Error: .env.unit に DATABASE_URL が設定されていません。");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// 役割マスタ（ROLE001-015）。単体テストが code 引きする正準集合として seed-unit が保持する契約
// （共有定数にはしない・Issue #584）。定義順＝上位から並べ、superiorCd を投入時に解決する。
const ROLES = [
  // 社長（最上位）
  { cd: "ROLE001", name: "社長", positionCd: "POS004", superiorCd: null as string | null },
  // 本部長
  {
    cd: "ROLE002",
    name: "営業本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  {
    cd: "ROLE003",
    name: "管理本部長",
    positionCd: "POS003",
    superiorCd: "ROLE001" as string | null,
  },
  // 部長
  { cd: "ROLE004", name: "営業部長", positionCd: "POS002", superiorCd: "ROLE002" as string | null },
  { cd: "ROLE005", name: "開発部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE006", name: "総務部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE007", name: "人事部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  { cd: "ROLE008", name: "経理部長", positionCd: "POS002", superiorCd: "ROLE003" as string | null },
  // 課長
  {
    cd: "ROLE009",
    name: "営業一課長",
    positionCd: "POS001",
    superiorCd: "ROLE004" as string | null,
  },
  {
    cd: "ROLE010",
    name: "営業二課長",
    positionCd: "POS001",
    superiorCd: "ROLE004" as string | null,
  },
  {
    cd: "ROLE011",
    name: "開発一課長",
    positionCd: "POS001",
    superiorCd: "ROLE005" as string | null,
  },
  {
    cd: "ROLE012",
    name: "開発二課長",
    positionCd: "POS001",
    superiorCd: "ROLE005" as string | null,
  },
  { cd: "ROLE013", name: "総務課長", positionCd: "POS001", superiorCd: "ROLE006" as string | null },
  { cd: "ROLE014", name: "人事課長", positionCd: "POS001", superiorCd: "ROLE007" as string | null },
  { cd: "ROLE015", name: "経理課長", positionCd: "POS001", superiorCd: "ROLE008" as string | null },
];

async function main(): Promise<void> {
  console.log("Seeding unit-test master data...");

  // 役職（自己参照 FK）: 上位から作る必要があるため定義を reverse（社長 → 課長）。
  const positionIdMap = new Map<string, string>(); // cd → id
  for (const pos of [...POSITIONS].reverse()) {
    const superiorPositionId = pos.superiorCd ? (positionIdMap.get(pos.superiorCd) ?? null) : null;
    const record = await prisma.position.upsert({
      where: { positionCd: pos.cd },
      update: { name: pos.name, superiorPositionId },
      create: { id: generateId(), positionCd: pos.cd, name: pos.name, superiorPositionId },
    });
    positionIdMap.set(pos.cd, record.id);
  }
  console.log(`Upserted ${POSITIONS.length} positions`);

  // 役割（自己参照 FK）: 定義順＝上位から作れば superiorCd が既に解決済み。
  const roleIdMap = new Map<string, string>(); // cd → id
  for (const role of ROLES) {
    const superiorRoleId = role.superiorCd ? (roleIdMap.get(role.superiorCd) ?? null) : null;
    const record = await prisma.role.upsert({
      where: { roleCd: role.cd },
      update: { name: role.name, positionId: positionIdMap.get(role.positionCd)!, superiorRoleId },
      create: {
        id: generateId(),
        roleCd: role.cd,
        name: role.name,
        positionId: positionIdMap.get(role.positionCd)!,
        superiorRoleId,
      },
    });
    roleIdMap.set(role.cd, record.id);
  }
  console.log(`Upserted ${ROLES.length} roles`);

  // 消費税率（effectiveFrom が @unique）。
  for (const tr of TAX_RATES) {
    await prisma.taxRate.upsert({
      where: { effectiveFrom: tr.effectiveFrom },
      update: { rate: tr.rate },
      create: { id: generateId(), rate: tr.rate, effectiveFrom: tr.effectiveFrom },
    });
  }
  console.log(`Upserted ${TAX_RATES.length} tax rates`);

  console.log("Unit-test master seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
