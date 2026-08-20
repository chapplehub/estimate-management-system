import { ValidationError } from "@server/shared/errors/DomainError";
import { ValueObject } from "@server/shared/ValueObject";

/**
 * 発生日時の不変値オブジェクト（occurredAt）
 *
 * 承認・差戻・取下といったイベントが起きた瞬間（instant）を表す。内部表現を epoch
 * ミリ秒（`number`）とし、可変オブジェクトである `Date` をドメインAPIから締め出す
 * （ADR-20260624-8f5）。`number` は値セマンティクスで共有が原理的に発生しないため、
 * 防御コピーの規律に頼らず不変性を言語レベルで保証できる。
 *
 * 共有基底 {@link ValueObject}（`number` ブランド・null ガード・`constructor.name` 弁別の
 * `equals`）を継承し、`FiscalYear`（ADR-0024）と同型の VO 文化に揃える。`validate` で
 * 非有限値（Invalid Date 由来の `NaN` 等）を構築時に弾き、反射律が壊れた VO を作らせない。
 *
 * raw `Date` の getter は設けない。`Date` が必要な表示/DTO 用途には {@link toDate} が
 * 毎回新インスタンスを返す。`Date` ↔ VO の変換は infra 境界（Mapper の {@link from}）と
 * 現在時刻取得（{@link now}）の2点に局所化する。
 */
export class OccurredAt extends ValueObject<number, "OccurredAt"> {
  private constructor(epochMillis: number) {
    super(epochMillis);
  }

  protected validate(value: number): void {
    if (!Number.isFinite(value)) {
      throw new ValidationError(`発生日時が不正です（有限なミリ秒ではありません）: ${value}`);
    }
  }

  /** raw `Date` から生成する。`getTime()` を取り出した瞬間に可変オブジェクトとの縁が切れる。 */
  static from(date: Date): OccurredAt {
    return new OccurredAt(date.getTime());
  }

  /** 現在時刻で生成する。ドメイン内の現在時刻取得はこの口に寄せる。 */
  static now(): OccurredAt {
    return new OccurredAt(Date.now());
  }

  /** 表示/DTO 用途に `Date` を返す。毎回新インスタンスを鋳造するため共有は起きない。 */
  toDate(): Date {
    return new Date(this._value);
  }
}
