import { describe, expect, it } from "vitest";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import {
  type ApplicationOperationFacts,
  type EstimateApplicationDetailProjection,
  type EstimateApplicationDetailQueryService,
} from "../EstimateApplicationDetailQueryService";
import { GetEstimateApplicationDetailQuery } from "../GetEstimateApplicationDetailQuery";

const ESTIMATE_NUMBER = "EST-0001";
const VARIATION_NUMBER = 1;
const APPLICANT = "emp-applicant";
const MEMBER = "emp-member";
const AWAITING_ROLE = "role-awaiting";

/** hasMember だけを決め打ちする fake。集合 `${roleId}:${employeeId}` に含まれれば true。 */
function fakeRoleQueryService(members: Set<string>): RoleQueryService {
  const notUsed = () => {
    throw new Error("このテストでは使用しないメソッドです");
  };
  return {
    hasMember: async (roleId: string, employeeId: string) => members.has(`${roleId}:${employeeId}`),
    findById: notUsed,
    search: notUsed,
    findAll: notUsed,
    findByPositionId: notUsed,
    findByRoleCd: notUsed,
    findRoleIdsWithMembers: notUsed,
    isSoleMember: notUsed,
  } as unknown as RoleQueryService;
}

/** findDetail を決め打ちする fake query service。 */
function fakeQueryService(
  projection: EstimateApplicationDetailProjection | null
): EstimateApplicationDetailQueryService {
  return { findDetail: async () => projection };
}

/** PENDING の APPLICATIONS projection を組む（operationFacts は上書き可）。 */
function pendingProjection(
  facts?: Partial<ApplicationOperationFacts>
): EstimateApplicationDetailProjection {
  return {
    kind: "APPLICATIONS",
    summary: {
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      customerName: "得意先A",
      deliveryLocationName: "納品先A",
      submissionType: "SUBMITTED",
      finalTotal: 500000,
      applicationState: { code: "PENDING", label: "申請中" },
    },
    latest: {
      applicationId: "app-latest",
      attempt: 1,
      applicantName: "申請者A",
      appliedAt: new Date("2026-07-01T00:00:00Z"),
      finalApprovalPositionName: "課長",
      status: { code: "PENDING", label: "申請中" },
      steps: [],
      withdrawal: null,
    },
    past: [],
    operationFacts: {
      isPending: true,
      applicantEmployeeId: APPLICANT,
      awaitingRoleId: AWAITING_ROLE,
      latestApplicationId: "app-latest",
      awaitingStepId: "step-awaiting",
      expectedVersion: 3,
      ...facts,
    },
  };
}

function buildQuery(
  projection: EstimateApplicationDetailProjection | null,
  members: Set<string>
): GetEstimateApplicationDetailQuery {
  return new GetEstimateApplicationDetailQuery(
    fakeQueryService(projection),
    fakeRoleQueryService(members)
  );
}

describe("GetEstimateApplicationDetailQuery（操作可否を app 層で合成）", () => {
  it("申請中で操作者が承認待ち役割のメンバーなら canApprove/canReject=true・標的が載る", async () => {
    const query = buildQuery(pendingProjection(), new Set([`${AWAITING_ROLE}:${MEMBER}`]));

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: MEMBER,
    });

    expect(result?.operations.canApprove).toBe(true);
    expect(result?.operations.canReject).toBe(true);
    expect(result?.operations.latestApplicationId).toBe("app-latest");
    expect(result?.operations.awaitingStepId).toBe("step-awaiting");
    expect(result?.operations.expectedVersion).toBe(3);
  });

  it("申請中で操作者が申請者本人（かつ非メンバー）なら canWithdraw=true・canApprove/canReject=false", async () => {
    const query = buildQuery(
      pendingProjection(),
      new Set() // 承認待ち役割のメンバーではない
    );

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: APPLICANT,
    });

    expect(result?.operations.canWithdraw).toBe(true);
    expect(result?.operations.canApprove).toBe(false);
    expect(result?.operations.canReject).toBe(false);
    // 申請中なのでコマンド標的は載る（フラグが false でも PENDING の申請は存在する）。
    expect(result?.operations.latestApplicationId).toBe("app-latest");
    expect(result?.operations.expectedVersion).toBe(3);
  });

  it("申請中でも操作者が本人でもメンバーでもなければ全フラグ false（標的は載る）", async () => {
    const query = buildQuery(pendingProjection(), new Set());

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: "emp-stranger",
    });

    expect(result?.operations.canApprove).toBe(false);
    expect(result?.operations.canReject).toBe(false);
    expect(result?.operations.canWithdraw).toBe(false);
    expect(result?.operations.latestApplicationId).toBe("app-latest");
  });

  it("非 PENDING（例: 承認済）なら操作者がメンバー/本人でも全フラグ false・標的 null", async () => {
    const query = buildQuery(
      pendingProjection({
        isPending: false,
        awaitingRoleId: null,
        awaitingStepId: null,
      }),
      new Set([`${AWAITING_ROLE}:${MEMBER}`])
    );

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: APPLICANT, // 本人でも
    });

    expect(result?.operations.canApprove).toBe(false);
    expect(result?.operations.canReject).toBe(false);
    expect(result?.operations.canWithdraw).toBe(false);
    expect(result?.operations.latestApplicationId).toBeNull();
    expect(result?.operations.awaitingStepId).toBeNull();
    expect(result?.operations.expectedVersion).toBeNull();
  });

  it("免除（EXEMPTED）は全フラグ false・標的 null で、EXEMPTED 枝の DTO を返す", async () => {
    const projection: EstimateApplicationDetailProjection = {
      kind: "EXEMPTED",
      summary: {
        estimateNumber: ESTIMATE_NUMBER,
        variationNumber: VARIATION_NUMBER,
        customerName: "得意先A",
        deliveryLocationName: "納品先A",
        submissionType: "SUBMITTED",
        finalTotal: 50000,
        applicationState: { code: "EXEMPTED", label: "承認不要" },
      },
      exemption: {
        reason: { code: "BELOW_THRESHOLD", label: "10万円未満" },
        exemptedByName: "免除者A",
        exemptedAt: new Date("2026-07-02T00:00:00Z"),
      },
      operationFacts: {
        isPending: false,
        applicantEmployeeId: null,
        awaitingRoleId: null,
        latestApplicationId: null,
        awaitingStepId: null,
        expectedVersion: null,
      },
    };
    const query = buildQuery(projection, new Set());

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: APPLICANT,
    });

    expect(result?.kind).toBe("EXEMPTED");
    if (result?.kind === "EXEMPTED") {
      expect(result.exemption.reason.label).toBe("10万円未満");
    }
    expect(result?.operations.canApprove).toBe(false);
    expect(result?.operations.canWithdraw).toBe(false);
    expect(result?.operations.expectedVersion).toBeNull();
  });

  it("projection が null（NotFound）ならそのまま null を返す", async () => {
    const query = buildQuery(null, new Set());

    const result = await query.execute({
      estimateNumber: "NOPE",
      variationNumber: 99,
      operatorEmployeeId: MEMBER,
    });

    expect(result).toBeNull();
  });

  it("APPLICATIONS 枝の表示ビュー（summary/latest/past）はそのまま透過する", async () => {
    const query = buildQuery(pendingProjection(), new Set());

    const result = await query.execute({
      estimateNumber: ESTIMATE_NUMBER,
      variationNumber: VARIATION_NUMBER,
      operatorEmployeeId: "emp-stranger",
    });

    expect(result?.kind).toBe("APPLICATIONS");
    expect(result?.summary.estimateNumber).toBe(ESTIMATE_NUMBER);
    if (result?.kind === "APPLICATIONS") {
      expect(result.latest.applicationId).toBe("app-latest");
      expect(result.past).toEqual([]);
    }
    // projection の operationFacts は最終 DTO に漏れない。
    expect((result as unknown as { operationFacts?: unknown }).operationFacts).toBeUndefined();
  });
});
