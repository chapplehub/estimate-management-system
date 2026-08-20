# C4: バリエーション内容更新フロー

見積詳細画面で既存バリエーションの明細ツリー（明細・セット群・値引・メモ）を編集して保存するまで。**C1/C3 と部品をほぼ共有し、C4 固有の差分は 3 点** — (a) `version` 照合による楽観ロック、(b) 既存内容の全置換（`replaceContent`）、(c) `itemId` 突合による永続単価の保全。

- **入口**: `[estimateNumber]/actions.ts` `updateVariationContent`（Server Action）
- **コマンド**: `UpdateVariationCommand.execute`
- **集約操作**: `Estimate.updateVariation` → `EstimateVariation.replaceContent`（子エンティティを全消し全作り直し）
- **永続化**: `PrismaEstimateRepository.update`（C3 と同じ差分 upsert）

---

## シーケンス図

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 利用者
    participant Form as VariationEditForm<br/>(Client)
    participant Action as updateVariationContent<br/>(Server Action)
    participant Zod as updateVariationContentNodeSchema<br/>(zod + conform)
    participant Cmd as UpdateVariationCommand
    participant Wrap as checkTaxRateThenSave<br/>(app-shared)
    participant Est as Estimate / EstimateVariation<br/>(domain)
    participant Repo as PrismaEstimateRepository
    participant DB as PostgreSQL

    Note over Form: 明細は VariationLineEditor で編集（C1/C3 共有）<br/>hidden で version と variationId を往復【A】
    User->>Form: 明細を編集して「保存」
    Form->>Action: FormData<br/>（nodes JSON + version + variationId）

    Action->>Zod: parseWithZod(formData, {schema})
    Note over Zod: updateVariationContentNodeSchema =<br/>共通 variationContentFields（version含む） + variationId（C4固有）<br/>lineSchema.itemId で既存行を突合（ADR-20260709-5ea）
    Zod-->>Action: 検証済み入力

    Action->>Action: getEstimateDetailQuery で estimateId 解決（client 非信頼）
    Action->>Action: toVariationContentInputFromNodes(value)【B】
    Note over Action: union配列 → items + setGroups（C1/C3 共有）<br/>itemId を保持したまま組み直し<br/>→ UpdateVariationInput{estimateId, variationId, version, content}

    Action->>Cmd: execute(UpdateVariationInput)
    Cmd->>Repo: findById(EstimateId)
    Repo-->>Cmd: Estimate（既存集約）
    Cmd->>Cmd: 対象バリを variations.find(id) で特定
    Cmd->>Cmd: existingLines = 既存 items を itemId→{productId, unitPrice} に索引化【C】
    Cmd->>Cmd: resolveLineTreePrices(content, ctx, resolver, existingLines)
    Note over Cmd: itemId 一致かつ productId 不変なら永続単価を保持<br/>それ以外はサーバ権威で再解決（ADR-0064）
    Cmd->>Cmd: buildVariationContent(toVariationContentDescriptor(content, priceMap))
    Cmd->>Cmd: assertSetComponentsValid(content, productQueryService)（ADR-0052）

    Cmd->>Est: updateVariation(variationId, content)【D】
    Note over Est: editableVariationOrThrow → replaceContent<br/>子エンティティ（item/setGroup）を全消し全作り直し<br/>宣言的全置換（差分更新ではない）→ recalculate
    Est-->>Cmd: void（集約内部を更新）

    Cmd->>Wrap: checkTaxRateThenSave(estimate, version, deps)
    Note over Wrap: 見積年月日と締切日の税率を §8.7 整合チェック
    alt 税率不一致（§8.7）
        Wrap-->>Action: {kind:"taxRateMismatch", ...}
        Action-->>Form: submission.reply(formErrors) ／保存せず入力維持
    else 一致
        Wrap->>Repo: update(estimate, expectedVersion)【E】
        Note over Repo: runAtomically で 1 トランザクション<br/>estimate.updateMany WHERE id AND version → +1<br/>count 0 なら ConflictError（楽観ロック関門）
        Repo->>DB: 旧 item を notIn delete、新 item を create<br/>セット群 upsert・交差表は全 delete + createMany
        Repo->>DB: refetch（ESTIMATE_FULL_INCLUDE）→ toDomain
        DB-->>Repo: Estimate（確定金額はドメイン権威値・ADR-0033）
        Repo-->>Wrap: Estimate
        Wrap-->>Action: {kind:"saved", estimate}
        Action->>Action: revalidatePath / redirect(?reason=ESTIMATE_UPDATED)
        Action-->>User: 302 → 詳細画面
    end

    Note over Action,DB: 競合時：ConflictError は handleCommandError で<br/>「他のユーザーによって更新されています」とフォーム表示（redirect しない）
```

---

## C1/C3 との共有 / C4 固有差分

| 部品 | 共有範囲 | C4 の扱い |
|------|---------|-----------|
| `nodesField` / `toVariationContentInputFromNodes` | C1/C3/C4 | そのまま共有（`itemId` を保持） |
| `VariationLineEditor` / `useVariationLineEditor` | C1/C3/C4 | フォームが `version` と `variationId` を hidden 往復 |
| `variationContentFields`（version 含む） | C3/C4 | スキーマに `variationId` を追加（C3 は `submissionType`） |
| `resolveLineTreePrices`（`resolveLinePrices.ts:100`） | C1/C3/C4 | **`existingLines` を渡す**（C1/C3 は空） |
| `toVariationContentDescriptor` / `buildVariationContent` | C3/C4 | そのまま共有 |
| `checkTaxRateThenSave` | C2/C3/C4 | そのまま共有 |
| `Repository.update` 差分 upsert | C2/C3/C4 | そのまま共有 |
| 集約への反映 | — | **【C4固有】`Estimate.updateVariation` → `replaceContent`（全置換）** |
| 単価保全 | — | **【C4固有】`itemId` 突合で永続単価を保持（ADR-20260709-5ea）** |

### 【A】明細編集 UI は共有、往復トークンが固有

明細編集は C1/C3 と同じ `VariationLineEditor`。C4 固有は **hidden で `version`（楽観ロックトークン）と `variationId`（更新対象）を往復**させる点。初期値は閲覧 DTO（`VariationDTO`）を `fromVariationLines` でノード union へ写して供給する。

### 【B】組み直しは共有、`itemId` を保持

`toVariationContentInputFromNodes` は C1/C3 と同一関数。ただし C4 では `lineSchema.itemId`（`variationSchema.ts:17`）で既存行のキーを持ち回り、`toItemInput` 経由で保持する。これが後の単価保全【C】の突合キーになる。

### 【C】`itemId` 突合による永続単価の保全（C4 固有の肝）

コマンドが対象バリの既存 `items` を `itemId → {productId, unitPrice}` の Map（`existingLines`）に索引化し、`resolveLineTreePrices` に渡す。`preservedPriceFor`（`resolveLinePrices.ts:118`）が **`itemId` 一致かつ `productId` 不変なら価格決定を呼ばず永続単価をそのまま返す**。行を触っていないのに単価がマスタ現在値で上書きされるのを防ぐ。C1/C3 は `existingLines` を渡さないため常に再解決する。

### 【D】`replaceContent` による宣言的全置換

`Estimate.updateVariation`（`Estimate.ts:297`）→ `EstimateVariation.replaceContent`（`EstimateVariation.ts:320`）が **子エンティティ（item/setGroup）を全消し全作り直し**する。ドメインは差分更新ではなく「新しい内容セットで宣言的に全置換」する（`_items.length = 0; _items.push(...)`）。改訂先（行構成固定・§7.2）や無効状態は `assertLineStructureMutable` / `assertEditable` でガード。

### 【E】永続化は delete + 再 create として現れる

ドメインが全置換 → 全 item が新 id を持つため、`Repository.update` では旧行が `notIn` delete、新行が create される（実質 delete + 再 create）。セット群ヘッダは被参照のため identity 保持の upsert、交差表 `EstimateSetComponent` は全 delete → createMany で作り直す（ADR-0047）。version は `WHERE version = expectedVersion` の条件付き increment で bump（`count === 0` → `ConflictError`）。

---

## 関連 ADR

- ADR-0033: 確定金額はドメイン権威値で再表示時に上書き
- ADR-0039: 更新系は集約ルートの version で楽観ロック
- ADR-0052: セット構成のライブ区分・有効性検証はアプリ層（集約越え）
- ADR-20260709-5ea: 既存行は `itemId` で突合し、触っていない行の永続単価を保全
- ADR-0064: 見積単価はサーバ権威で解決（C1 と共有）
