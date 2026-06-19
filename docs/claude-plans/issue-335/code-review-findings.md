# PR #400 コードレビュー指摘（見積詳細 S7 無効化/有効化・#335）

- 対象: PR #400 / `feat/issue-335`（base: `develop`）
- レビュー: `/code-review high #400`（8 finder 角度 → 1-vote 検証 → Playwright MCP 実機検証）
- 実施日: 2026-06-19
- 総評: アプリ層 2 コマンドは TDD でよく担保され、**マージを止める正しさバグは無し**。事前レビューで最優先（正しさ）として挙げた「楽観ロック version の陳腐化」は **Playwright 実機検証で反証**し取り下げ。残りは E2E のテスト品質と軽微な表示の磨き込み。

## 対応状況

| 指摘 | 区分 | 状況 |
|---|---|---|
| 1 | 正しさ | 取り下げ（Playwright 実機検証で反証） |
| 2 | テスト品質 | 任意対応（serial chain の単独再実行性） |
| 3 | 表示・軽微 | 任意対応（hidden フィールドエラーの不表示） |

## 指摘1（取り下げ・参考）

> 【正しさ】conform 管理の hidden `version` が redirect 後に再同期されず、リロードを挟まない 2 回目のトグルが古い `expectedVersion` を送って ConflictError になる

**Playwright MCP の実機検証で反証**（→ 取り下げ）。

### 検証手順と結果（dev DB / N9905001・6 バリ）

リロードを挟まず連続トグルを実行し、DOM 上の hidden `version` 入力値を毎回計測した。

| 操作 | hidden `version` | 既定タブ | 結果 |
|---|---|---|---|
| 初期表示 | 6 | V1 | ● 有効 |
| ① V1 を無効化（redirect 後・リロード無し） | **7** | V2 へ自動移動 | 成功・エラー無し |
| ② V2 を無効化（連続 2 回目・リロード無し） | **8** | V4 へ自動移動 | **成功・ConflictError 無し** |

### 反証の根拠

- hidden `version` は redirect のたびに **6→7→8 と正しく増加**しており陳腐化していない。
- 各トグル後に**既定タブが次の ACTIVE バリへ自動移動**した。これは `VariationPanel` の `useState(firstActive…)`（VariationPanel.tsx:72-73）が**再初期化**された＝**Server Action の `redirect()` でクライアントアイランドが毎回再マウントされている**ことを示す。
- 再マウント時に `useServerForm` → conform の `useState(() => createFormContext(...))`（`@conform-to/react` hooks.js:39）が**新しい `version` で再生成**されるため、`getInputProps(fields.version)` の値は常に最新になる。

### 当初分析の誤り

conform 内部の解析（`onUpdate` は `formId`／`lastResult` 変化時しか `initialValue` を再同期しない。`@conform-to/dom` form.js:484）自体は正しかったが、**「Server Action の redirect ではクライアントアイランドが保持される」という前提が実環境では誤り**だった。実際は `revalidatePath` + `redirect` により毎回再マウントが起き、conform context ごと作り直されるため version 陳腐化は発生しない。

### 波及（同根で取り下げた候補）

- **E2E `estimates-variation-status.e2e.ts` test 3 が落ちるという疑いも取り下げ**。連続 2 トグルが成功する以上 test 3 は green であり、`deviations.md` の「chain 終端で両バリを再有効化し seed 状態へ復元」も成立する。

---

## 指摘2 【テスト品質】serial chain が共有 seed を破壊的に変更し、単独再実行できない

- 対象: `src/app/(features)/estimates/estimates-variation-status.e2e.ts:526`（`describe.serial`）
- 内容: test1 が V1 を無効化、test2 が全無効化、test3 が末尾で両バリを再有効化して復元する構成。状態復元は **test3 が最後まで通った場合のみ**成立する。
- 失敗シナリオ: 途中の test が落ちると seed `N9905007` が dirty（全 INACTIVE 等）のまま残る。`pnpm e2e` はフル実行時のみ再シードするため、Playwright のリトライ・`--last-failed`・UI モードなど**再シードを伴わない単独再実行**では test1 冒頭の「● 有効」前提が崩れ、初期状態次第で偽 pass／偽 fail になる。
- 補足: 正しさバグではなくテストの堅牢性。`beforeEach`/`beforeAll` で対象 seed の状態を明示復元するか、各 test が前提状態を assert してから進む形にすると単独再実行に強くなる。

## 指摘3 【表示・軽微】hidden フィールドのバリデーションエラーが画面に出ない

- 対象: `src/app/(features)/estimates/[estimateNumber]/VariationStatusToggle.tsx:39-46`
- 内容: 表示しているのは `form.errors`（フォーム全体エラー）のみで、`fields.version`／`fields.variationId` の**フィールド単位のエラーは描画されない**。`parseWithZod` が失敗（`status !== "success"`）すると `submission.reply()` を返すが、フィールドエラーは画面に現れずボタンが無反応に見える。加えて `key={e}`（45 行）はメッセージ重複でキー衝突しうる。
- 失敗シナリオ: 何らかの理由で hidden `version` が空・非数値になり `z.coerce.number().int()` がフィールドエラーになると、サイレント失敗（押しても何も起きない）になる。
- 補足: 当該 2 フィールドは `value={version}`／`value={variationId}` でサーバ制御の hidden のため**実運用での到達はほぼ無く、優先度は低い**。`form.allErrors` を見るか、表示系入力を持つ他フォームと違い全項目 hidden である点に留意した文言提示にすると堅い。

---

## 検証で REFUTED（取り下げ・参考）

- **指摘1（version 陳腐化）** → Playwright 実機検証で反証（上記）。
- **`actions.ts` の `formErrors: []` 握り潰し疑い** → `handleCommandError`（`_shared/error-handler.ts:36-64`）は全分岐で必ず非空 `error` を返すため、`errorMessage ? [errorMessage] : []` が `[]` になる経路は到達不能。
- **`redirect()` を try/catch 内で握り潰す疑い** → `redirect`／`revalidatePath` は try の外に置かれており NEXT_REDIRECT は伝播する。問題なし。
- **seed `N9905007`／`buildS7ToggleEstimate` の不整合疑い** → 番号は `SEED_ESTIMATE_NUMBERS` 内で一意、FK 解決・builder 形は兄弟と一致（NEW 専用ファクトリで `estimateType` は入力に含めない）。他 E2E は件数走査でなく特定番号参照のため影響なし。
- **コマンドテストの Prisma 直利用 vs ADR-0012** → 同規則は `.e2e.ts` 限定で、兄弟コマンドテスト（`UpdateVariationCommand.test.ts` 等）も全て `prisma` 直 import が前例。違反でない。
- **ドメイン側の挙動** → `deactivateVariation` に「最低 1 つ ACTIVE」ガードは無く全無効は正規（ADR-0051）、未存在 variationId は `BusinessRuleViolationError`、`activate/deactivate` は冪等で凍結も貫通。コマンド／コメントの主張と一致。問題なし。

## 優先度の目安

1. 短期（任意）: 指摘3 はフォーム表示の磨き込みのみで局所的・低コスト。
2. 中期（任意）: 指摘2 は E2E の堅牢性。次に状態変更系 E2E を触る際に `beforeEach` 復元 or 前提 assert を検討。
3. **正しさ・マージ可否**: 阻害要因なし。トグル機能は連続操作でも正常に動作することを実機で確認済み。
