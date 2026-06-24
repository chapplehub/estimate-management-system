/**
 * 発生日時の不変値オブジェクト（occurredAt）
 *
 * 承認・差戻・取下といったイベントが起きた瞬間（instant）を表す。内部表現を epoch
 * ミリ秒（`number`）とし、可変オブジェクトである `Date` をドメインAPIから締め出す
 * （ADR-20260624-8f5）。`number` は値セマンティクスで共有が原理的に発生しないため、
 * 防御コピーの規律に頼らず不変性を言語レベルで保証できる。
 *
 * raw `Date` の getter は設けない。`Date` が必要な表示/DTO 用途には {@link toDate} が
 * 毎回新インスタンスを返す。`Date` ↔ VO の変換は infra 境界（Mapper の {@link from}）と
 * 現在時刻取得（{@link now}）の2点に局所化する。
 */
export class OccurredAt {
  private constructor(private readonly _epochMillis: number) {}

  /** raw `Date` から生成する。`getTime()` を取り出した瞬間に可変オブジェクトとの縁が切れる。 */
  static from(date: Date): OccurredAt {
    return new OccurredAt(date.getTime());
  }

  /** 現在時刻で生成する。ドメイン内の現在時刻取得はこの口に寄せる。 */
  static now(): OccurredAt {
    return new OccurredAt(new Date().getTime());
  }

  equals(other: OccurredAt): boolean {
    return this._epochMillis === other._epochMillis;
  }

  /** 表示/DTO 用途に `Date` を返す。毎回新インスタンスを鋳造するため共有は起きない。 */
  toDate(): Date {
    return new Date(this._epochMillis);
  }
}
