# ADR-0025: ドメイン層での日時境界判定は JST 固定の純関数で行う

| 項目         | 値         |
| ------------ | ---------- |
| ステータス   | 採用       |
| 起票日       | 2026-05-23 |
| 最終更新日   | 2026-05-23 |

## コンテキスト

Issue #282 で `FiscalYear.from(date: Date): FiscalYear` を実装する際、「4 月始まり年度」の境界判定を JST で行う必要があった。同様の TZ 依存判定は今後以下でも発生する見込み:

- 消費税率の適用年月日判定（§8.7「税率チェック対象」）
- 締切判定・月次/年次の業務締め（§12.1）
- 受注作成日の年度判定
- 各種「営業日」判定（将来）

JavaScript の `Date` 型は内部的に UTC ミリ秒を保持し、`getMonth()` `getFullYear()` などの非 UTC メソッドは **プロセスの TZ 設定** に依存する。本番環境は以下のいずれかになりうる:

- **Vercel デフォルト**: UTC（`process.env.TZ` 未設定）
- **自前 Docker**: 設定次第（UTC・JST どちらもあり得る）
- **ローカル開発**: 開発者の OS 設定（多くは JST だが UTC や他 TZ もあり得る）

`getMonth()` を素朴に使うと、JST 4/1 00:00:00 がサーバ TZ によって 3 月扱いになる（UTC サーバの場合 UTC 3/31 15:00:00 として解釈）。この差が年度判定で 1 年のズレを生む。

ドメイン層は CLAUDE.md のレイヤリングルールにより **外部依存禁止**（Prisma / Next.js / 外部ライブラリの import 不可）。`Intl.DateTimeFormat` は標準 API だが、TZ をプロセス設定経由で読む API は環境差を持ち込むため避けたい。

## 検討した選択肢

### A. ローカル TZ メソッド（`Date.getMonth()` 等）を素朴に使う（不採用）

```typescript
static from(date: Date): FiscalYear {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  // ...
}
```

最もシンプル。サーバ TZ が JST に設定されていれば期待通り動く。

しかし:
- Vercel デフォルトは UTC のため、サーバ TZ 設定の前提を失念すると本番で 1 年ズレるバグが入る
- テストが「プロセス TZ に依存」する。CI 環境（GitHub Actions 等は UTC）とローカル（多くは JST）で結果が異なりうる
- 「ドメインロジックが暗黙にインフラ設定に依存する」状態。レイヤリング原則の精神に反する

### B. サーバ TZ を強制的に JST に設定する運用（不採用）

```dockerfile
ENV TZ=Asia/Tokyo
```

```typescript
// next.config.ts 等
process.env.TZ = "Asia/Tokyo";
```

を起動コードに含め、`getMonth()` 等のローカルメソッドを安全に使えるようにする。

しかし:
- インフラ設定（Dockerfile / Vercel 環境変数 / Next.js 設定）が **ドメインロジックの正しさを担保する**構造になる。ドメイン層のテストがプロセス TZ に依存し、`describe.each` でクロス TZ テストするのが困難
- Vercel ではコンテナ環境変数 `TZ` の挙動がリージョン・プランで微妙に異なる
- 他のプロジェクトに知見を再利用しづらい

### C. `Intl.DateTimeFormat("Asia/Tokyo")` で TZ 変換する（不採用）

```typescript
const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" });
const parts = fmt.formatToParts(date);
```

標準 API のみで TZ 変換可能。外部ライブラリ依存ゼロ。

しかし:
- 文字列フォーマット → パースという回り道で、リーダビリティが低い
- ロケール挙動（暦の区切り、年号 = 令和等）に巻き込まれるリスク
- 性能はそこまでクリティカルではないが、純関数の単純な算術より遅い

### D. UTC ミリ秒に +9h オフセットを加えて UTC メソッドで判定する純関数（採用）

```typescript
private static readonly JST_OFFSET_MS = 9 * 60 * 60 * 1000;

static from(date: Date): FiscalYear {
  const jstDate = new Date(date.getTime() + FiscalYear.JST_OFFSET_MS);
  const month = jstDate.getUTCMonth() + 1;  // ← UTC メソッド
  const year = jstDate.getUTCFullYear();
  const fiscalYear = month < FiscalYear.FISCAL_START_MONTH ? year - 1 : year;
  return new FiscalYear(fiscalYear);
}
```

UTC ミリ秒を +9h シフトしてから `getUTC*` 系メソッドを使う。`getUTC*` はプロセス TZ に依存しないため、結果はサーバ TZ に左右されない。**完全な純関数**。

## 決定

ドメイン層で日時境界判定を行う場合は、**JST 固定**で、**UTC ミリ秒に +9h オフセットを加えて `getUTC*` 系メソッドを使う純関数**として実装する。`Date.getMonth()` `getFullYear()` 等のローカル TZ 依存メソッドはドメイン層では使わない。

サマータイム（DST）は日本標準時に存在しないため、固定オフセット +9h で問題ない。

## 根拠

### 純関数性とテスト決定性

オフセット計算は入力 `Date.getTime()`（UTC ミリ秒）にのみ依存するため、**テストがプロセス TZ から独立**する。CI 環境（UTC）でもローカル（JST）でも同じ結果が出る。テストデータは ISO 8601 文字列（`"2025-04-01T00:00:00+09:00"` または `"2025-03-31T15:00:00Z"`）で TZ を明示できる。

### ドメイン層の外部依存ゼロ原則と整合

`Intl.DateTimeFormat` は標準 API だが、ロケール DB やプロセス設定の影響を受けるブラックボックスを含む。純粋な算術 `+9 * 3600 * 1000` はそうした暗黙依存がない。CLAUDE.md の「ドメイン層は外部依存禁止」の精神（=「予測可能で純粋な計算であること」）に最も近い。

### 業務システムが日本国内専用

本システムは日本国内向けの見積管理であり、海外展開の予定はない。**全業務日時は JST 解釈で固定して問題ない**。多 TZ 対応が必要になった時点で改めて検討する（YAGNI）。

### 不採用理由まとめ

- **A（ローカルメソッド）**: 本番 TZ が UTC のとき年度が 1 年ズレるバグ源。テストもプロセス TZ 依存
- **B（サーバ TZ 強制 JST）**: インフラ設定がドメイン正しさを担保する構造。テスト容易性が低い
- **C（Intl.DateTimeFormat）**: 純関数性は得られるが、文字列フォーマット経由で冗長、ロケール挙動のリスクあり

## 影響

- **ドメイン層で日時を扱う VO・サービスはすべて本パターンを踏襲**:
  - 税率マスタの適用年月日判定
  - 締切判定
  - 受注作成日の年度判定
  - 営業日判定（将来）
- **オフセット定数は `9 * 60 * 60 * 1000` を直接書くか、`JstClock` のようなヘルパに集約するか**は当面 VO 個別で持つ（重複が 3 ヶ所を超えたら集約検討）。`FiscalYear.JST_OFFSET_MS` を最初の例とする
- **`Date.getMonth()` `getFullYear()` `getDate()` `getHours()` 等のローカル TZ 依存メソッドはドメイン層で禁止**。lint ルールでの強制までは行わない（コードレビューと本 ADR で運用）
- **テストでは ISO 8601 の TZ 明示文字列**（`+09:00` または `Z`）で `Date` を作る。`new Date(2025, 3, 1)` のようなローカル TZ 依存コンストラクタは使わない
- **サマータイム導入時は本 ADR の見直しが必要**（現時点では制定議論なし）
- **多 TZ 対応が必要になった場合**は本 ADR を差替えとし、TZ パラメータを引数で受ける形に拡張する
- 関連: `src/server/shared/domain/values/FiscalYear.ts`, `src/server/shared/domain/values/__tests__/FiscalYear.test.ts`, ADR-0024
