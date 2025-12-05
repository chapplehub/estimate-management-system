import { ValueObject } from "@server/shared/ValueObject";
import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";

// テスト用の具体的なValueObjectサブクラス
type TestStringBrand = { readonly _brand: unique symbol };
class TestStringValue extends ValueObject<string, TestStringBrand> {
  protected validate(value: string): void {
    if (value.length === 0) {
      throw new InvalidArgumentError("Value cannot be empty");
    }
  }

  get value(): string {
    return this._value;
  }
}

type TestNumberBrand = { readonly _brand: unique symbol };
class TestNumberValue extends ValueObject<number, TestNumberBrand> {
  protected validate(value: number): void {
    if (value < 0) {
      throw new InvalidArgumentError("Value must be non-negative");
    }
  }

  get value(): number {
    return this._value;
  }
}

describe("ValueObject 基底クラス", () => {
  describe("正常系", () => {
    it("有効な文字列値でインスタンスを作成できる", () => {
      const value = new TestStringValue("test");
      expect(value.value).toBe("test");
    });

    it("有効な数値でインスタンスを作成できる", () => {
      const value = new TestNumberValue(42);
      expect(value.value).toBe(42);
    });

    it("同じ値を持つインスタンスは等しい", () => {
      const value1 = new TestStringValue("test");
      const value2 = new TestStringValue("test");
      expect(value1.equals(value2)).toBe(true);
    });

    it("異なる値を持つインスタンスは等しくない", () => {
      const value1 = new TestStringValue("test1");
      const value2 = new TestStringValue("test2");
      expect(value1.equals(value2)).toBe(false);
    });

    it("異なる型のインスタンスは同じ値でも等しくない", () => {
      const stringValue = new TestStringValue("42");
      const numberValue = new TestNumberValue(42);
      // TypeScriptの型システム上は比較できないが、実行時には異なる型として扱われる
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(stringValue.equals(numberValue as any)).toBe(false);
    });

    it("toStringメソッドで文字列表現を取得できる", () => {
      const stringValue = new TestStringValue("test");
      expect(stringValue.toString()).toBe("test");

      const numberValue = new TestNumberValue(42);
      expect(numberValue.toString()).toBe("42");
    });

    it("Date型の値を扱える", () => {
      type TestDateBrand = { readonly _brand: unique symbol };
      class TestDateValue extends ValueObject<Date, TestDateBrand> {
        protected validate(value: Date): void {
          if (value.getTime() < 0) {
            throw new InvalidArgumentError("Invalid date");
          }
        }

        get value(): Date {
          return this._value;
        }
      }

      const date = new Date("2025-01-01");
      const dateValue = new TestDateValue(date);
      expect(dateValue.value).toBe(date);
    });

    it("boolean型の値を扱える", () => {
      type TestBooleanBrand = { readonly _brand: unique symbol };
      class TestBooleanValue extends ValueObject<boolean, TestBooleanBrand> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        protected validate(_value: boolean): void {
          // No validation for boolean
        }

        get value(): boolean {
          return this._value;
        }
      }

      const boolValue = new TestBooleanValue(true);
      expect(boolValue.value).toBe(true);
    });
  });

  describe("異常系", () => {
    it("null値で作成するとInvalidArgumentErrorが発生する", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new TestStringValue(null as any)).toThrow(
        InvalidArgumentError
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new TestStringValue(null as any)).toThrow(
        "Value must be defined"
      );
    });

    it("undefined値で作成するとInvalidArgumentErrorが発生する", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new TestStringValue(undefined as any)).toThrow(
        InvalidArgumentError
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new TestStringValue(undefined as any)).toThrow(
        "Value must be defined"
      );
    });

    it("validateメソッドで検証エラーが発生すると例外が投げられる", () => {
      expect(() => new TestStringValue("")).toThrow(InvalidArgumentError);
      expect(() => new TestStringValue("")).toThrow("Value cannot be empty");
    });

    it("数値の検証エラーが正しく処理される", () => {
      expect(() => new TestNumberValue(-1)).toThrow(InvalidArgumentError);
      expect(() => new TestNumberValue(-1)).toThrow(
        "Value must be non-negative"
      );
    });

    it("validateメソッドはensureValueIsDefinedの後に実行される", () => {
      // null/undefinedの場合は、validateまで到達せず、ensureValueIsDefinedで例外が発生する
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => new TestStringValue(null as any)).toThrow(
        "Value must be defined"
      );
    });
  });

  describe("equals メソッド", () => {
    it("自分自身と等しい", () => {
      const value = new TestStringValue("test");
      expect(value.equals(value)).toBe(true);
    });

    it("同じクラスの同じ値のインスタンスと等しい", () => {
      const value1 = new TestStringValue("test");
      const value2 = new TestStringValue("test");
      expect(value1.equals(value2)).toBe(true);
      expect(value2.equals(value1)).toBe(true);
    });

    it("異なるクラスのインスタンスとは等しくない", () => {
      type AnotherBrand = { readonly _brand: unique symbol };
      class AnotherStringValue extends ValueObject<string, AnotherBrand> {
        protected validate(value: string): void {
          if (value.length === 0) {
            throw new InvalidArgumentError("Value cannot be empty");
          }
        }
      }

      const value1 = new TestStringValue("test");
      const value2 = new AnotherStringValue("test");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(value1.equals(value2 as any)).toBe(false);
    });
  });
});
