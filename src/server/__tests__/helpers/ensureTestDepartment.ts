import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";

/**
 * テスト用の部署マスタレコードを確実に作成・取得する。
 * 並列実行時のレースコンディションに対応:
 * - update に値を指定し ON CONFLICT DO UPDATE を保証（空 update の DO NOTHING 問題を回避）
 * - upsert 自体が失敗した場合は findUniqueOrThrow でフォールバック
 */
export async function ensureTestDepartment(): Promise<string> {
  try {
    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: { name: "テスト部署" },
      create: {
        id: generateId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    return dept.id;
  } catch {
    const dept = await prisma.department.findUniqueOrThrow({
      where: { departmentCd: "TEST_DEPT" },
    });
    return dept.id;
  }
}
