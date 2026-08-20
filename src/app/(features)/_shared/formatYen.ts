/**
 * 10進文字列の売単価を円表示へ整形する（#473・client/server 両用の純関数）。
 *
 * BE 読みモデルは精度保持のため単価を `"1000.00"` のような10進文字列で運ぶ（ADR-0022）。表示整形に
 * `Number` を経由すると float 誤差を招くため、文字列のまま桁区切りを施す。小数部は意味のある桁
 * （非ゼロ）があるときだけ残す（`"1000.00"`→`¥1,000`、`"12.50"`→`¥12.5`）。`Money` は server 専用の
 * ため client 列でも使える本ヘルパを別途置く。
 */
export function formatYenFromDecimal(decimal: string): string {
  const [intPart, fracPart] = decimal.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracPart && /[1-9]/.test(fracPart) ? `.${fracPart.replace(/0+$/, "")}` : "";
  return `¥${sign}${grouped}${frac}`;
}
