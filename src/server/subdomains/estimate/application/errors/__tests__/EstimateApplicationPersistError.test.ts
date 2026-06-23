import { ApplicationError } from "@server/shared/errors/ApplicationError";
import { describe, expect, it } from "vitest";
import { EstimateApplicationPersistError } from "../EstimateApplicationPersistError";

describe("EstimateApplicationPersistError", () => {
  it("所定の利用者向け文言と元エラー(cause)を保持する", () => {
    const cause = new Error("insert failed");

    const error = new EstimateApplicationPersistError(cause);

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe("EstimateApplicationPersistError");
    expect(error.message).toBe("申請に失敗しました。もう一度申請してください。");
    expect(error.cause).toBe(cause);
  });
});
