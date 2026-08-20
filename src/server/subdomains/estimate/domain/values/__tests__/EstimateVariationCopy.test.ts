import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateVariationCopy } from "../EstimateVariationCopy";
import { EstimateVariationId } from "../EstimateVariationId";

describe("EstimateVariationCopy", () => {
  describe("create() - 正常系", () => {
    it("複製先・複製元を保持する", () => {
      const copied = EstimateVariationId.generate();
      const source = EstimateVariationId.generate();

      const copy = EstimateVariationCopy.create(copied, source);

      expect(copy.copiedVariationId.equals(copied)).toBe(true);
      expect(copy.sourceVariationId.equals(source)).toBe(true);
    });
  });

  describe("create() - 異常系", () => {
    it("複製先と複製元が同一なら拒否する", () => {
      const id = EstimateVariationId.generate();

      expect(() => EstimateVariationCopy.create(id, id)).toThrow(InvalidArgumentError);
    });
  });

  describe("equals()", () => {
    it("複製先・複製元がともに一致すれば等価", () => {
      const copied = EstimateVariationId.generate();
      const source = EstimateVariationId.generate();

      const a = EstimateVariationCopy.create(copied, source);
      const b = EstimateVariationCopy.create(copied, source);

      expect(a.equals(b)).toBe(true);
    });

    it("複製元が異なれば非等価", () => {
      const copied = EstimateVariationId.generate();
      const a = EstimateVariationCopy.create(copied, EstimateVariationId.generate());
      const b = EstimateVariationCopy.create(copied, EstimateVariationId.generate());

      expect(a.equals(b)).toBe(false);
    });
  });
});
