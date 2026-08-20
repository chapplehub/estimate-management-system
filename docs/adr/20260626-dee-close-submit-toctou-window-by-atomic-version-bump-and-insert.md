# ADR-20260626-dee: 申請 submit の version bump と申請挿入を単一トランザクションで原子化し、兄弟二重前進の TOCTOU 窓を閉じる

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-26 |
| 最終更新日 | 2026-06-26 |

## コンテキスト

ADR-0068 は「1見積1前進」の直列化を、見積 version の条件付き更新を申請挿入の**前段の関門**に置き、集約またぎトランザクションを張らないことで実現すると決めた。その際、唯一の隙を「bump 成功・insert 失敗（無害な version 空振り、再 Preview で回復）」と整理し、これを根拠に選択肢 B（2集約の単一トランザクション化）を「コスト倒れ」として退けた。

しかし PR #437（#417）のレビューで、ADR-0068 が見落とした**もう1つの並行性の窓**が判明した（ADR-0068 §残存リスク・#440）。`SubmitApplicationCommand` の `estimateRepository.update()`（version bump）と `applicationRepository.insert()` は**別トランザクション**であり、bump コミット〜insert コミットの間に窓がある。

1. T1 がバリエーション A を申請。`update(version=k)` 成功 → `k+1` を**コミット**（A の application 行はまだ未挿入）。
2. その瞬間、T2 が同見積のバリエーション B を Preview し新版 `k+1` を読む。
3. T2 が B を申請。`assertNoAdvancingVariation` は未挿入の A を観測できず通過 → `update(version=k+1)` 成功 → `k+2`、B を insert。
4. A・B が両方 PENDING で前進し、「1見積1前進」が破れる。

version 関門は「**同一版を同時に叩く者**」しか直列化しない。bump コミット後に新版を正当に Preview した後続は関門を通る。唯一の横断ガードである兄弟チェックは非トランザクションのため、この窓を塞げない。`@@unique([variationId, attempt])` は同一バリの重複は弾くが**別バリ**の二重前進は弾けない。

ADR-0068 が選択肢 B を退けた根拠「唯一の隙は無害な空振り」が、この**有害な**窓の発見で崩れた。費用対効果が反転したため、ADR-0068 の「集約またぎ tx を張らない」スタンスを #440 で再評価する。

根本原因は構造的である。「1見積1前進」は本来 Estimate 集約の不変条件だが、判定材料（前進状態）は ADR-0058 により別集約（`EstimateApplication` / `EstimateApprovalExemption`）の行の存在から導出される。集約が自分の不変条件を境界の外の状態で守らねばならず、集約またぎ協調＝窓を生む。

## 検討した選択肢

### A. submit の bump と挿入を単一トランザクションで原子化（採用）

version bump（`Estimate.version` の条件付き UPDATE）と申請/免除の挿入を、**1つの DB トランザクション**で囲う。順序は従来どおり「bump → insert」。両リポジトリが同一トランザクションハンドルで動くよう、アプリ層に集約またぎトランザクション境界（`TransactionRunner` 相当）を導入する。これは ADR-0068 の選択肢 B の再採用にあたる。

「version が k+1 になる瞬間に申請行も同時に可視になる」ため、「version は進んだのに行が不可視」の継続時間がゼロになる。どの interleaving でも後続は *version 関門で死ぬ*（stale 版で 0 行 → `ConflictError`）か、*兄弟チェックで弾かれる*（A が可視）かのどちらかになり、窓が消える。兄弟チェックを tx 内へ移す必要はない——関門の行ロックと bump+insert の原子性で全 interleaving を被覆する（§影響）。

### B. 前進枠（advancing slot）を Estimate 集約へ載せる（不採用）

「どのバリが前進枠を占有しているか」を表す `advancingVariationId` 列を Estimate に持たせ、既存の条件付き UPDATE が同時に前進枠も奪う（単一集約操作に戻す）。窓は閉じるが、(1)「前進」がスロットと ADR-0058 の導出ステータスの**二重表現**になり両者の整合義務が生じる、(2) withdraw/reject 時のスロット解放が別集約またぎの整合義務を新設する、(3) nullable 列が NULL 徹底排除方針（ADR-0034）に逆行する。

### C. DB バックストップ（部分ユニーク/排他制約）の再導入（不採用）

DB 制約で「1見積1前進」を強制する。だが ADR-0058 が詳述した通り、真の不変条件は application + exemption の**横断**（3状態×2テーブル）で、単一表の部分ユニークでは5穴中1穴（同時 PENDING 同士）しか塞げない。ADR-0058 が「半端」として手放した当の問題に逆戻りする。

### D. 申請を見積集約へ取り込む（full-merge）（不採用）

`EstimateApplication` を `Estimate` 集約の一部にし、submit を単一集約の in-memory 不変条件として強制する。窓は最も素直に閉じるが、爆風半径が過大（§根拠）。

## 決定

**A を採用する。** submit の瞬間だけ、version bump と申請/免除挿入を**単一トランザクション**で原子化する。アプリ層に集約またぎトランザクション境界を導入し、`SubmitApplicationCommand` の bump と insert を同一 tx で実行する。ADR-0068 の version 関門・兄弟チェック・version トークンの TOCTOU 兼用はそのまま維持し、**変えるのはトランザクション境界の1点のみ**。ADR-0058（行の存在で導出・アプリ層一元化）も集約境界も保つ。

## 根拠

- **不変条件が即時整合を要求する範囲は最小**。Vernon の集約設計則1（真の不変条件は整合性境界に）と則2（集約は小さく）が衝突したときの定石は「不変条件が即時整合を要求する**最小のデータ**だけを同居させる」。「1見積1前進」が即時整合を要求するのは「どのバリが今、前進枠を占有しているか」の**1事実**だけで、承認ステップ・plan・承認者割当・承認/差戻/取下イベントまで同居させる必要はない。それらは申請という別アクター（承認者）の、submit 後に独立して動くライフサイクルに属する。窓が噛むのは submit の一瞬だけなので、その一瞬を原子化すれば足りる。
- **full-merge（D）は爆風半径が過大**。申請の分離は ADR-0053/0054/0056/0058/0061/0062/0063 の土台で、特に ADR-0061 は進行ロックをアプリ層に置く理由を「判定材料は集約の外」と明記する。full-merge はこれら全ての前提を崩す。さらに version は集約ルートに1つ（ADR-0039 細目1）ゆえ、承認者の「バリ A を approve」と作成者の「作成中バリ B を編集」（進行ロックはバリ単位で B は編集可・ADR-0061）が同じ `estimate.version` を bump して**偽競合**する。別アクター・別ライフサイクルを1つのロックに押し込む恒久的結合を、一瞬の不変条件のために買うことになる。
- **A は文書化された哲学との乖離が最小**。ADR-0058 の導出設計もアプリ層一元化も小さい集約も保ち、覆すのは ADR-0068 の「集約またぎ tx を張らない」1点のみ。そしてその撤回理由は #440 が明示的に追跡を託したもの。
- **B/C は本コードベースの方針に逆行**。B は導出（ADR-0058）と NULL 排除（ADR-0034）に、C は ADR-0058 のバックストップ廃止決定に逆らう。

## 影響

- **集約またぎトランザクション境界の新設**。本コードベース初。`PrismaEstimateRepository.update` は自前で `$transaction` を開いて差分 upsert する（ADR-0032）ため、**外部から渡されたトランザクションハンドルで動く**形に開く改修が要る。application/exemption の insert 経路も同様。境界はアプリ層に置き、ドメイン層は tx を知らない（DDD レイヤリング維持）。
- **`EstimateApplicationPersistError`（ADR-0068 ケース2）が不要になる**。bump と insert が原子になると「bump 成功・insert 失敗」は insert 失敗ごとロールバックされ、無害な version 空振りすら起きなくなる。エラーは「関門失敗＝`ConflictError`」と「正常 union」の**2分岐**に単純化する。ADR-0068 が新設した本例外と Server Action 側の専用文言写像は撤去対象。撤去の是非・移行は #440 実装で確定する。
- **兄弟チェックは tx 内へ移さず現在位置（関門の前段）に残す**。関門の条件付き UPDATE が estimate 行ロックを取り、bump+insert が原子であることから、stale 版の後続は関門で 0 行となり死に、新版を読んだ後続は兄弟チェックで A を可視に観測して弾かれる。全 interleaving が被覆されるため、兄弟チェックの移設は不要（移しても害はないが、関門が主役という ADR-0068 の整理を保つ）。
- **免除パスも同一扱い**。EXEMPT 分岐の exemption 挿入も bump と同一 tx で原子化する。
- **ADR-0068 は維持しつつ本 ADR で更新**。version 関門・兄弟チェック・TOCTOU トークン兼用は不変。ADR-0068 §残存リスクの窓は本 ADR で解消（forward pointer を ADR-0068 に追記）。
- **テスト**: 原子性の実体は単一 `$transaction` の ACID（PostgreSQL 保証）。リポジトリ統合テストで「bump→insert 失敗時に version が進んでいない（ロールバック）」を逐次再現する。真の並行テスト（`Promise.all`）は flaky の割に証明力が増えないため主役にしない（ADR-0039 影響・テスト方針と同じ思想）。

## 関連

- ADR-0068（version 関門を申請挿入の前段に置く・集約またぎ tx を張らない＝本 ADR がトランザクション境界の1点を更新）
- ADR-0058（状態を行の存在で導出・DB バックストップ廃止・アプリ層一元化）
- ADR-0039（集約ルート version による横断楽観ロック・version は子に持たせない・集約またぎ非原子性の既存リスク受容）
- ADR-0061（進行ロックはバリ単位・判定材料は集約外ゆえアプリ層配置）
- ADR-0053/0054（申請・免除テーブルを見積から分離）
- ADR-0034（NULL 徹底排除方針）
- ADR-0032（差分 upsert＝update が自前 tx を張る永続化方式）
- ADR-0037/0038（複数の正常結末は union・失敗は例外）
- `src/server/subdomains/estimate/application/commands/SubmitApplicationCommand.ts`
- `learning/aggregate-boundary-minimal-consistency-for-transient-invariant.md`
- Vaughn Vernon『Effective Aggregate Design』集約設計則1・2
