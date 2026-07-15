import { describe, expect, it } from "vitest";

import { defineTestCodes } from "../defineTestCodes";

/**
 * 共有DB単体テストのコード割当ファクトリの門番（#608）。
 *
 * `defineTestCodes` は「コードをキーにした宣言」から「所有者→用途別コード＋全コード配列」の
 * 派生索引を import 時に一度だけ構築する。同一コードの二重割当は TypeScript の TS1117（重複
 * オブジェクトキー）がコンパイル時に弾くため、このテストは **TS1117 では捕まらない** 不変条件
 * ——形式ガード・用途キーの重複・予約語・派生索引の構造——を DB非依存で機械検証する。
 */
describe("defineTestCodes", () => {
  it("所有者ごとに用途キーからコードを引ける派生索引を構築する", () => {
    const index = defineTestCodes(/^ROLE9\d{2}$/, {
      ROLE971: { owner: "employee.roleNames", use: "assignedRole" },
      ROLE972: { owner: "employee.roleNames", use: "seniorRole" },
      ROLE981: { owner: "role.updateCommand", use: "target" },
    });

    expect(index["employee.roleNames"].assignedRole).toBe("ROLE971");
    expect(index["employee.roleNames"].seniorRole).toBe("ROLE972");
    expect(index["role.updateCommand"].target).toBe("ROLE981");
  });

  it("codes に所有者の全コードを宣言順で束ねる（cleanup 用・生成用の単一ソース）", () => {
    const index = defineTestCodes(/^ROLE9\d{2}$/, {
      ROLE971: { owner: "employee.roleNames", use: "assignedRole" },
      ROLE972: { owner: "employee.roleNames", use: "seniorRole" },
      ROLE973: { owner: "employee.roleNames", use: "leafRole" },
      ROLE981: { owner: "role.updateCommand", use: "target" },
    });

    expect(index["employee.roleNames"].codes).toEqual(["ROLE971", "ROLE972", "ROLE973"]);
    expect(index["role.updateCommand"].codes).toEqual(["ROLE981"]);
  });

  it("形式に合致しないコードは throw する（帯外流出・seed帯侵入の検出）", () => {
    // ROLE001 は seed 済み正準マスタ帯。9xx 帯パターンから外れるため弾かれる。
    expect(() =>
      defineTestCodes(/^ROLE9\d{2}$/, {
        ROLE001: { owner: "x", use: "a" },
      })
    ).toThrow(/ROLE001/);
  });

  it("同一所有者で用途キーが重複すると throw する（TS1117 が捕えない衝突）", () => {
    // コードキー(ROLE971/ROLE972)は異なるため TS1117 は発火しない。派生索引の用途キーが
    // 衝突して上書きされる事故をランタイムで殺す。
    expect(() =>
      defineTestCodes(/^ROLE9\d{2}$/, {
        ROLE971: { owner: "employee.roleNames", use: "assignedRole" },
        ROLE972: { owner: "employee.roleNames", use: "assignedRole" },
      })
    ).toThrow(/assignedRole/);
  });

  it("用途キーに予約語 codes は使えない（派生索引の codes 配列と衝突するため）", () => {
    expect(() =>
      defineTestCodes(/^ROLE9\d{2}$/, {
        ROLE971: { owner: "employee.roleNames", use: "codes" },
      })
    ).toThrow(/codes/);
  });
});
