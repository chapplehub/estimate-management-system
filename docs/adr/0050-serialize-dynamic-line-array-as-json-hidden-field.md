# ADR-0050: 動的明細配列は conform field-array でなく単一 JSON hidden field で往復する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-15 |
| 最終更新日 | 2026-06-15 |

## コンテキスト

見積詳細画面のバリ内容編集（S4 / C4 `UpdateVariationCommand`）は、バリエーション内容を**宣言的に全置換**する（`EstimateVariation.replaceContent`）。保存時に「明細配列まるごと＋全体値引＋メモ2種＋楽観ロック version」を1リクエストで送る必要がある。

問題は明細が**動的配列**である点だ。明細は次の操作で形が変わる:

- 商品選択モーダル経由の追加（productId・商品名/単位スナップショットはモーダル由来でクライアント state）
- 行の削除
- インライン編集（数量・単価・掛率・値引・メモ）
- D&D 並び替え（dnd-kit）

リポジトリの既存フォーム（customers/products、および S3 見積ヘッダー編集）は **conform-to を素直に使う**のが参照パターンだが、それらはすべて**固定フィールド**のフォームだった。S4 で初めて「動的に増減・並び替えされる配列」をサーバへ往復させる必要が生じた。この往復方式は後続の S5（セット明細編集）も継承するため、編集まわり全体の契約を定める判断になる。

## 検討した選択肢

### A. conform-to の field-array（`getFieldList` ＋ insert/remove/reorder intent）（不採用）

最も conform 的で、JS 無効環境でもサーバ往復で配列操作が成立する（プログレッシブエンハンスメント）。一方、明細値の多く（productId・商品名/単位スナップショット）はモーダル由来でそもそもクライアント state 管理であり、D&D 並び替えとも相性が悪い。conform の field-array intent とクライアント state を二重管理することになり、実装が破綻しやすい。

### B. 単一 JSON hidden field ＋ zod transform（採用）

明細配列は React の作業コピー（state）で保持し、submit 時に単一の hidden へ `JSON.stringify`。サーバ側 schema は `z.string().transform(JSON.parse).pipe(明細配列schema)` で検証し、`VariationContentInput` へマップする。

```ts
// schema（サーバ）
const linesField = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "明細データが不正です" });
      return z.NEVER;
    }
  })
  .pipe(z.array(lineSchema));
```

```tsx
// フォーム（クライアント）: 作業コピーを hidden に載せるだけ
<input type="hidden" name={fields.lines.name} value={JSON.stringify(workingLines)} />
```

conform-to（`useServerForm`）は**送信トランスポートとエラー表示の器**として残す。version 往復（ADR-0039）・税率不一致（`taxRateMismatch`）のフォームエラー表示・スカラー項目（全体値引・メモ）の検証はシェルでそのまま再利用する。

### C. conform を捨てて全項目をクライアント state ＋ 単一 JSON hidden（不採用）

最もシンプルだが、S3 までのフォームパターンと乖離し、スカラー項目のエラー表示やフォームライフサイクルを自前で書くことになる。

## 決定

C4 配線フォームでは、動的な明細配列を React 作業コピーで保持し、submit 時に単一 hidden へ `JSON.stringify`、サーバは `z.string().transform(JSON.parse).pipe(...)` で検証して `VariationContentInput` へマップする（選択肢 B）。conform-to は送信トランスポートとエラー表示の器として残す。

## 根拠

- 明細はモーダル選択・インライン編集・D&D で**本質的にクライアント state が真実**になる。conform の field-array と二重管理するより、state を単一 JSON で往復させる方が破綻しない。
- sortOrder は「作業コピーの配列順 = 真実」とし submit 時に index から導出するため、追加・削除・D&D が「配列を組み替えるだけ」に統一できる（C4 が全置換なので、サーバは受け取った順序をそのまま新セットとして書く）。
- conform シェルを残すことで、S3 とのパターン整合・version 往復・税率不一致のフォームエラー表示をそのまま再利用できる。
- **不採用理由**: A は明細値がモーダル由来かつ D&D 対象で、conform の配列機構とクライアント state の二重管理が破綻する。C は既存フォームパターンからの乖離が大きく、エラー表示を自前で書くコストが見合わない。

## 影響

- **意図的な逸脱**: リポジトリ全体が conform-to を素直に使う中で、この経路だけ JSON blob を使う。次のエンジニアが「conform field-array に直すべき」と考えるのは自然だが、それは上記の理由で破綻するため、本 ADR で逸脱を記録して"修正"を止める。
- JS 無効環境では明細編集が機能しない（version・全体値引・メモ等のスカラー項目のみ degrade）。プログレッシブエンハンスメントを犠牲にする。
- S5（セット明細編集）も同じ往復方式を継承する。セット群・構成明細の表現を JSON に載せる形で拡張する想定。
- JSON の壊れ・型不正は `transform`/`pipe` でフォームエラーに一本化できる。
