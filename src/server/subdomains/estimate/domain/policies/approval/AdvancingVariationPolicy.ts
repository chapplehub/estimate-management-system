import { VariationApplicationState } from "../../values/approval/VariationApplicationState";

/**
 * 見積単位の前進ゲートポリシー（「1見積1前進」・CONTEXT「前進バリエーション」）
 *
 * 副作用のない純関数。バリエーション各々の申請状態（{@link VariationApplicationState}・
 * 免除／申請を畳み込み還元済み）を受け取り、見積内に前進中のバリエーションが存在するかを判定する。
 *
 * 命令側（{@link SubmitApplicationCommand}・前進があれば申請を弾く）と読み取り側
 * （#493 `GetVariationApplicationStatesQuery` の `canApply`）が同一述語を共有し、ドリフトを封じる。
 * 「還元」は VO（`VariationApplicationState.reduce`）、「見積単位ゲート」は本ポリシーが負う。
 * 各バリの `isAdvancing()` が申請中・承認済・免除を吸収するため、免除と申請を別々に判定しない。
 */
export class AdvancingVariationPolicy {
  private constructor() {}

  /** 見積内に前進中のバリエーションが1つでも存在するか。 */
  static hasAdvancingVariation(states: ReadonlyArray<VariationApplicationState>): boolean {
    return states.some((state) => state.isAdvancing());
  }
}
