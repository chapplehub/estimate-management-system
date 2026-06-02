import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { CompanyType, ProductCategory, ProductUnit } from "@generated/prisma/enums";

import { ensureTestDepartment } from "./ensureTestDepartment";

/**
 * 見積集約の永続化テストに必要な FK マスタ（部署・作成者従業員・得意先・納品先・商品）を
 * 確実に用意し、その ID を返す。すべて予約コードで冪等 upsert する（並列実行に耐える）。
 *
 * これらは Estimate の create 時に連鎖作成されない共有マスタなので、テスト見積の保存前に
 * 存在している必要がある。
 */
export type EstimateFixtureIds = {
  departmentId: string;
  employeeId: string;
  customerId: string;
  deliveryLocationId: string;
  productId: string;
};

const EMPLOYEE_CD = "EMP999091";
const CUSTOMER_COMPANY_CODE = "CFX99901";
const DELIVERY_COMPANY_CODE = "DFX99901";
const PRODUCT_CODE = "PRDFX99901";
const PRODUCT_NAME = "見積永続化テスト商品";

export async function ensureEstimateFixtures(): Promise<EstimateFixtureIds> {
  const departmentId = await ensureTestDepartment();

  const employee = await prisma.employee.upsert({
    where: { employeeCd: EMPLOYEE_CD },
    update: { name: "見積テスト作成者" },
    create: {
      id: generateId(),
      employeeCd: EMPLOYEE_CD,
      email: "estimate-fixture@example.com",
      name: "見積テスト作成者",
      departmentId,
    },
  });

  // 得意先（Company + Customer）
  const customerCompany = await prisma.company.upsert({
    where: { code: CUSTOMER_COMPANY_CODE },
    update: { name: "見積テスト得意先" },
    create: {
      id: generateId(),
      code: CUSTOMER_COMPANY_CODE,
      name: "見積テスト得意先",
      type: CompanyType.CUSTOMER,
    },
  });
  const customer = await prisma.customer.upsert({
    where: { companyId: customerCompany.id },
    update: {},
    create: { id: generateId(), companyId: customerCompany.id },
  });

  // 納品先（Company + DeliveryLocation。親得意先は上記 customer）
  const deliveryCompany = await prisma.company.upsert({
    where: { code: DELIVERY_COMPANY_CODE },
    update: { name: "見積テスト納品先" },
    create: {
      id: generateId(),
      code: DELIVERY_COMPANY_CODE,
      name: "見積テスト納品先",
      type: CompanyType.DELIVERY_LOCATION,
    },
  });
  const deliveryLocation = await prisma.deliveryLocation.upsert({
    where: { companyId: deliveryCompany.id },
    update: {},
    create: { id: generateId(), companyId: deliveryCompany.id, customerId: customer.id },
  });

  const product = await prisma.product.upsert({
    where: { code: PRODUCT_CODE },
    update: { name: PRODUCT_NAME },
    create: {
      id: generateId(),
      code: PRODUCT_CODE,
      name: PRODUCT_NAME,
      category: ProductCategory.INDIVIDUAL,
      unit: ProductUnit.PIECE,
    },
  });

  return {
    departmentId,
    employeeId: employee.id,
    customerId: customer.id,
    deliveryLocationId: deliveryLocation.id,
    productId: product.id,
  };
}
