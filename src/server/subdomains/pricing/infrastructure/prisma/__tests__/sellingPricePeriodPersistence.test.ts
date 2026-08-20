import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Prisma } from "@generated/prisma/client";
import { describe, expect, it } from "vitest";
import { assertVersionBumped, translateInsertConflict } from "../sellingPricePeriodPersistence";

// `appendPeriodRows` は実 DB への INSERT 挙動（新規 id のみ挿入・既存行不変）を検証する
// 必要があり、SQL をモックすると「文の形」を見る実装結合テストになる。よって本ファイルでは
// 純粋ヘルパ（translateInsertConflict / assertVersionBumped）の分岐のみを単体で検証し、
// appendPeriodRows は各リポジトリの実 DB 結合テストに委ねる。

const knownRequestError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("db error", { code, clientVersion: "test" });

describe("translateInsertConflict", () => {
  it("P2002（一意制約違反）は渡したメッセージの ConflictError へ翻訳する", () => {
    const message = "商品 X の共通販売単価は既に登録されています。";

    let thrown: unknown;
    try {
      translateInsertConflict(knownRequestError("P2002"), message);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as Error).message).toBe(message);
  });

  it("P2002 以外の Prisma エラーは翻訳せず元エラーを rethrow する", () => {
    const original = knownRequestError("P2003"); // FK 制約違反など

    expect(() => translateInsertConflict(original, "競合メッセージ")).toThrow(original);
  });

  it("Prisma 以外の任意エラーはそのまま rethrow する", () => {
    const original = new Error("想定外のエラー");

    expect(() => translateInsertConflict(original, "競合メッセージ")).toThrow(original);
  });
});

describe("assertVersionBumped", () => {
  it("count === 0（version 不一致・行消失）は楽観ロックの ConflictError を throw する", () => {
    let thrown: unknown;
    try {
      assertVersionBumped(0);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as Error).message).toContain("他のユーザーによって更新または削除されています");
  });

  it("count >= 1（更新成功）は何もせず正常終了する", () => {
    expect(() => assertVersionBumped(1)).not.toThrow();
  });
});
