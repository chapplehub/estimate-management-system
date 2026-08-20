# ADR-20260723-h7r: read/query 系 Server Action は生の戻り値を保ち、非業務例外は呼び出し層の共通ラッパー（callReadAction）で toast + reportError に集約する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-23 |
| 最終更新日 | 2026-07-24 |

## コンテキスト

Server Action のエラー処理は二系統に分かれている。ミューテーション系（submit / approve / フォーム作成更新系）は `ActionResult<T>` の Result エンベロープを返し throw しない設計で、呼び出し側が戻り値分岐で toast / error state を表示する確立パターンがある。一方 read/query 系（`resolveEffectiveTaxRate` / `getProductSuggestions` / `search*ForSelection` 等）は生データを直接返し、呼び出し側（`useVariationLineEditor` ほか 9 箇所）はイベントハンドラ内で try/catch なしの裸 await をしていた。

このため read 系で非業務例外（DB 障害・ネットワーク断・想定外例外）が throw されると未処理 Promise 拒否となり、ユーザーへのフィードバックなく無言で失敗する。PR #631 のレビュー（R1-3 / R1-4）で個別指摘されたが、これは横断的な構造問題であるため方針を統一する（#633）。

前提となる技術的事実:

- **App Router のエラー境界（`error.tsx`）はイベントハンドラ内の async 例外を捕捉できない**。境界が拾うのはレンダリング・ライフサイクル中の throw のみで、該当箇所はすべて onClick 等のハンドラ起点のため、既存境界（ADR-20260721-ef0）に拾わせる案は技術的に成立しない。
- **セッション切れは既に自己完結している**。`verifySession` はセッション欠落時に `redirect("/signin?reason=SESSION_EXPIRED")` を呼び、Next.js が Server Action 内の redirect をクライアント側ナビゲーションとして処理する（クライアントの await に rejection としては現れない）。遷移先では `redirect-reason-toast` が理由を表示する。したがって本方針が扱う残りの失敗クラスは DB 障害・ネットワーク断・想定外例外の 3 つ。
- 本番の Next.js はサーバー内部の例外メッセージ・スタックをクライアントに送らず `digest`（相関 ID）に置換する。クライアント側で得られるのは「どの操作が失敗したか」まで、「なぜ失敗したか」はサーバーログとの digest 突き合わせで調べる二層構造が前提。

## 検討した選択肢

### A. read/query 系も Result エンベロープ化して戻り値分岐に統一する（不採用）

`Promise<CompanyRow[]>` → `Promise<ActionResult<CompanyRow[]>>` のように全 read Action のシグネチャを変更し、ミューテーション系と同じ戻り値分岐に揃える。

### B. 呼び出し層の共通ラッパー + toast + reportError（採用）

Action のシグネチャは生の戻り値のまま保ち、クライアント側の共通ラッパー `callReadAction` で catch して通知・記録し、`undefined` を返す。

```typescript
// src/app/_lib/callReadAction.ts
export async function callReadAction<T>(
  action: () => Promise<T>,
  context: string
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    reportError(error, context);
    toast.error(READ_ACTION_FAILED_MESSAGE, { id: "read-action-failed" });
    return undefined;
  }
}

// 呼び出し側
const suggestions = await callReadAction(
  () => getProductSuggestions(productId),
  "getProductSuggestions"
);
if (suggestions === undefined) return; // 操作中断・state 凍結
```

### C. 現状の裸 await を許容し、方針として明文化する（不採用）

無言失敗を仕様として受け入れ、レビューでの再指摘を方針文書で止める。

## 決定

read/query 系 Server Action は生の戻り値を保ち、呼び出し側は共通ラッパー `callReadAction`（catch → `reportError` 全件記録 + 固定 ID toast → `undefined` 返却）で包む。系統の使い分け基準は「**業務エラーを返す必要がある Action はエンベロープ、無い Action は生返し + ラッパー**」とする。

細目:

1. **失敗時契約は `undefined` sentinel**。`null` は既に業務上の意味（税率未設定・商品の並行削除）を背負っているため、インフラ失敗は `undefined` で区別する。失敗は常に一種類（非業務例外）で判別に載せる情報がないため、`{ok: false}` 型のミニ Result は採らない。
2. **`context` は呼び出す Server Action の関数名リテラル**（例: `"getProductSuggestions"`）。ログに出た文言をそのまま検索すれば Action 定義と全呼び出し箇所に到達できる（往復可能性）。動的組み立ては grep 到達性を壊すため禁止。
3. **toast は固定の汎用文言 1 種 + 固定 ID による重複統合**。`Promise.all` の並列呼び出しが一斉に失敗しても表示は 1 枚に畳まれる（sonner の同一 ID 統合）。`reportError` は catch のたびに呼ばれ、ログは全件記録される（ユーザー通知は 1 回・ログは全件、の非対称）。UI に技術詳細を出さない点は ADR-20260721-ef0 と同方針。
4. **失敗時の呼び出し側は「操作中断・state 凍結」**。**失敗した処理が書き込むはずだった画面 state に触らない**（ダイアログは開いたまま・古い表示は維持）。失敗を業務上の空値（例: 税率 `null` = 税率未設定）へ変換して嘘の業務状態を見せることを禁止し、同じ操作の再実行によるリトライ経路を自然に残す。
   - **横断ルール（#633 で細目として追加、#635 で一般化）**: **呼び出し先の振る舞いを戻り値で制御するコールバック契約は、値の不在に意味を割り当ててはならない。** 判別可能ユニオンで戻り値を必須にし、素の `return;` がコンパイルエラーになるようにする。
     - 理由: 「戻り値なし＝既定の振る舞い」にすると、**意図した既定と、書き忘れ・早期 return が型の上で区別できない**。`SelectionModal.onConfirm` は当初 `undefined` を「確定成功 → 閉じる」と解釈しており、失敗時に素の `return;` で抜けるとモーダルが閉じて検索結果・選択状態が捨てられ、state 凍結が破れた（#634 で実際に発生）。#635 で `SelectionOutcome`（`confirmed` / `rejected` / `aborted`）へ統合し、この経路を型で塞いだ（ADR-20260716-r4d）。
     - **対象外**: 呼び出し先が戻り値を見て分岐しない**通知型コールバック**（`onClose` / `onChange` / `onRowSelectionChange` 等）。これらは `void` のままでよく、無理に結果型を返させるのは過剰規約。
     - **判定基準**: 「呼び出し先がその戻り値を見て分岐するか」。分岐するなら本ルールの対象。この罠は `callReadAction` 固有でも `SelectionModal` 固有でもない（例えば `ProductSuggestDialog.confirmSuggestions` は現在「戻り値で閉じない」設計のため無事だが、await と早期 return が入れば同じ形になる）。
     - 中断を表す枝が `message` を持たないことで、決定3（通知は toast 1枚）との二重表示も避ける。
   - あわせて、業務値 `null`（例: 商品の並行削除）と非業務例外の `undefined` を集約段階で**同一視しない**こと。同一視すると業務経路の振る舞いまで巻き添えで変わる。
   - **「凍結」の適用範囲（#633 の実機検証で明確化）**: 凍結が守るのは「取得できなかった結果を、成功したかのように画面へ反映しないこと」であり、**操作の開始時点で行うリセットまでは巻き戻さない**。例えば `SelectionModal.handleSearch` は検索開始時に `setRowSelection({})` / `setRejection(null)` を呼ぶ（「新しい検索を始めたら選択と拒否表示を捨てる」という本決定とは独立した仕様・ADR-20260716-r4d）。この結果、検索が非業務例外で失敗すると**検索結果は維持されるが選択チェックは戻らない**。失敗時に state を復元する（開始時リセットを巻き戻す）ことは本決定の要求ではなく、これは違反にあたらない。判定基準は「その state への書き込みが、失敗した取得の**結果**に依存しているか」。
5. **`reportError` のログ接頭辞は `[error-boundary]` から `[report-error]` に一般化**。境界以外（本ラッパー）からも呼ばれるようになるため。境界 2 箇所は context 自体が境界名を含むので情報は失われない。

## 根拠

- **A（エンベロープ統一）の不採用理由**: read 系には業務エラーが存在せず、失敗は常に非業務例外の一種類だけ。`ActionResult` はフィールドバリデーションエラー等の業務分岐を運ぶための型であり、業務分岐のない read に適用すると全呼び出し箇所に情報量ゼロの `if (!result.success)` 分岐が増殖し、`Promise.all` で束ねる箇所は特に煩雑になる。型シグネチャも汚れる。
- **C（現状許容）の不採用理由**: 「ボタンを押したのに何も起きない」無言失敗は操作の成否を判断できない最悪の UX。#631 で同クラスの指摘が繰り返された事実（precedent: #595 / #621）が、明文化では再指摘が止まらないことを示している。
- **B の採用理由**: 捕捉ロジックは 1 関数に集約され、Action 側のシグネチャは不変、呼び出し側の変更は「await を 1 行包んで `undefined` ガードを足す」だけ。#632 の単一シーム設計（`reportError`）と一貫し、将来の実監視接続にもそのまま乗る。

## 影響

- 今後 read/query 系 Server Action をクライアントのイベントハンドラから呼ぶ際は `callReadAction` で包むことが規約となる（lint 等による機械的強制はせず、レビューと本 ADR で守る）。
- 複数画面から呼ばれる Action（例: `resolveEffectiveTaxRate`）は context だけでは発生画面を特定できない。grep で呼び出し箇所は即座に絞れるため許容し、実務で画面の区別が必要になった時点で引数追加を検討する。
- Server Component / ページの data fetch（レンダリング経路）は本 ADR の対象外。そちらの例外は従来どおりエラー境界（ADR-20260721-ef0）が受ける。
- テストは「捕まえた後に何をするか」（`undefined` 返却・`reportError` 呼び出し・toast 発火）のみ unit で検証し、9 箇所の配線自体の E2E は足さない（ADR-20260721-ef0 の検証方針と同型）。
