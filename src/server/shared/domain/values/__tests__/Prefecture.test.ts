import { describe, expect, it } from "vitest";
import { Prefecture } from "../Prefecture";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("Prefecture", () => {
  describe("正常系", () => {
    it("東京都を受け入れる", () => {
      const pref = new Prefecture("東京都");
      expect(pref.value).toBe("東京都");
    });

    it("北海道を受け入れる", () => {
      const pref = new Prefecture("北海道");
      expect(pref.value).toBe("北海道");
    });

    it("大阪府を受け入れる", () => {
      const pref = new Prefecture("大阪府");
      expect(pref.value).toBe("大阪府");
    });

    it("沖縄県を受け入れる", () => {
      const pref = new Prefecture("沖縄県");
      expect(pref.value).toBe("沖縄県");
    });
  });

  describe("異常系", () => {
    it("存在しない都道府県を拒否する", () => {
      expect(() => new Prefecture("テスト県")).toThrow(ValidationError);
      expect(() => new Prefecture("テスト県")).toThrow("有効な都道府県名を入力してください");
    });

    it("空文字を拒否する", () => {
      expect(() => new Prefecture("")).toThrow(ValidationError);
      expect(() => new Prefecture("")).toThrow("都道府県は必須です");
    });

    it("都道府県の部分一致を拒否する", () => {
      expect(() => new Prefecture("東京")).toThrow(ValidationError);
      expect(() => new Prefecture("東京")).toThrow("有効な都道府県名を入力してください");
    });
  });
});
