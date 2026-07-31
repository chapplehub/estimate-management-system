# Issue #719: Dependency Dashboard の「Pending Status Checks」誤クリック対策 — 実装計画

> **実行規約**: 各 step 完了時にこのファイルの該当チェックボックス（`- [ ]`）を
> `- [x]` に更新し、その更新を step のコミットに含めること。
> 再開時（compaction 後・新規セッション後を含む）は、まずこのファイルを読み、
> 未チェックの最小 step 番号から続行すること。
> **テスト戦略が `TDD` の step は red-green-refactor で進めること**（テストを先に書き、
> RED を確認してから実装する）。`/tdd` スキルの規約に従う。

## 概要

Dependency Dashboard（= issue #639）の `## Pending Status Checks` セクションのチェックボックス（`approvePr-branch=...`）を誤クリックすると、供給網 cooldown（`security:minimumReleaseAgeNpm`）と承認ゲート（`dependencyDashboardApproval`）が**同時に**無効化され、automerge（ADR-20260730-t6e）により CI 緑でそのまま自動マージまで到達する。

対策は**表示による抑止**に絞る。`dependencyDashboardHeader` に警告文を置き（対策 1）、Renovate 側の挙動と事後の復旧手順を `learning/` に記録する（対策 4）。押せなくする・自動マージさせないという構造的な阻止（対策 2・3）と cooldown 短縮（対策 5）は採らない（→ 設計判断）。

成果物は 3 点。

| 対象 | 内容 |
|---|---|
| `renovate.json` | `dependencyDashboardHeader` の追加 + `description` に 1 エントリ |
| `learning/renovate-dependency-dashboard-checkbox-semantics.md` | Renovate の挙動 7 項目（事後の復旧手順を含む） |
| PR 本文 | 対策 1〜5 の比較と、2・3・5 の棄却理由 |

前提の裏取りは Renovate 本体のソース（`lib/workers/repository/dependency-dashboard.ts` / `lib/workers/repository/update/branch/index.ts` / `lib/config/options/index.ts`）と #639 の実際の body で完了済み。

## 設計判断

### 対策の層：表示による抑止か、構造的な阻止か

- A. 表示による抑止のみ（対策 1 ヘッダー警告 + 対策 4 文書化）
- B. `internalChecksFilter` で Pending Status Checks を出さない（対策 2）
- C. cooldown 短絡で作られた PR を automerge させない（対策 3）
- D. `minimumReleaseAge` を短縮する（対策 5）
- **採用: A**

B は技術的に不成立。`internalChecksFilter`（既定 `strict`）は「pending なリリースを**バージョン選択の段階で**除外するか」の設定であり、ダッシュボードの表示制御ではない。`none` / `flexible` にすると pending なバージョンがそのまま採用され、cooldown 自体が死ぬ。セクションを消すためのノブは存在しない。

C には Renovate ネイティブの手段が 1 つだけある。Renovate はブランチに `renovate/stability-days` というステータスチェックを打っており（`statusCheckNames.minimumReleaseAge`）、cooldown 中は yellow。これを ruleset の required に入れれば、force 作成された PR も cooldown 満了まで platformAutomerge がマージできない。**ただし required checks はマージ先ブランチ単位でしか設定できず `renovate/*` に絞れない**ため、人間の PR には永久にこの context が来ず全 PR が恒久ブロックされる。制約を置きたい場所（Renovate PR だけ）と置ける場所（develop への全 PR）がずれている。

D は ADR-20260726-d3b の前提（供給網 cooldown の猶予）を直接弱める代償に対し、得られるのが「晒される時間が短くなる」だけで割に合わない。

### ヘッダー警告の射程：予防のみか、事後の復旧手順まで含むか

- A. 予防 2 点のみ（押すな／押しても次回実行前ならチェックを外せば無効化できる）
- B. 事後の復旧手順（auto-merge 解除・close するな）まで含める
- **採用: A**（復旧手順は `learning/` 側へ）

「その情報が必要になった瞬間に人間がどの画面に立っているか」で切り分けた。予防はダッシュボードを見ている最中に必要でヘッダーが唯一届く場所。復旧は PR 画面に立っている時の情報で、ダッシュボードの一等地に置いても届かない。ヘッダーは Pending Approval の上に積まれるため、長くすると本来の作業を押し下げて読み飛ばしを誘発する。

なお「押しても戻せる」を書くのは慈悲ではなく抑止の強度のため。取り返しがつかないと思わせる警告は、押してしまった人を放置に走らせる。

### 文書の分割：ADR を立てるか

- A. 新規 ADR を立てる
- B. ADR を立てず、棄却理由は PR 本文に書く
- **採用: B**

ADR-0000 の記録基準 3 条件（①覆すと複数コンポーネントに影響する ②理由を一言で言えず調査に時間がかかる ③2 つ以上の選択肢を検討した）のうち、②③ は満たすが **① を満たさない**。ヘッダー文は 1 行の削除で戻り、他のどのコンポーネントにも波及しない。ADR-0000 は「後から覆すコストが高い決定」を対象と明言している。

調査コストの受け皿は `learning/`、判断コストの受け皿が ADR という役割分担がこの repo には既にある。今回の棄却理由の中身は分解すると「判断」ではなく Renovate と GitHub の**仕様**に近く、`learning/` が家として正しい。

### `renovate.json` の `description` に何を書くか

- A. 「なぜ警告を置くか」のみ
- B. A に加えて「押せなくする手段は存在しない」という防壁まで
- **採用: A**

### ヘッダー文の体裁

- 言語は**日本語**（CLAUDE.md・ADR・description すべて日本語。読む人間は 1 人）
- ただし**セクション名は `## Pending Status Checks` と英語のまま引用**する。Renovate が出す見出しと文字列が一致していないと警告と現物を目で結べない
- **`> [!WARNING]` の GitHub alert 記法**を使う。issue body でも赤いバナーとして描画される。地の文で書くと「ダッシュボードの説明文」に埋没し、既定文言がリスクを示していないという元の問題を再生産する
- **既定文は残す**（alert の下に併記）。置換で失うのは docs リンク 1 本だけで、併記のコストはゼロ

### Mend ポータルリンクが消えた場合の扱い

- **採用: 復元しない**

現在 #639 の body 先頭は「既定文 + `<br>` + [View this repository on the Mend.io Web Portal]」で、後半は Mend Cloud が注入している。`dependencyDashboardHeader` の上書きで道連れに消える可能性がある（実物を見るまで確定しない）。飛び先は Mend の web UI のみで URL はリポジトリ固定のためブックマークで代替でき、逆に固定 URL を `renovate.json` に焼き込むと Mend 側の変更で腐ったリンクだけが残る。

### `CONTEXT.md` は更新しない

`CONTEXT.md` は見積・バリエーション・承認チェーンといった**業務ドメインの用語集**。「cooldown」「Pending Status Checks」は開発基盤側の語彙であり、混ぜると用語集の輪郭が崩れる。開発基盤の語彙の受け皿は `learning/` 側。

## ステップ

### Step 1: `renovate.json` に誤クリック抑止の警告を追加

- [ ] **完了**
- 対象ファイル: `renovate.json`
- テスト戦略: テスト不要（設定ファイル）
- 作業内容:
  - トップレベルに `dependencyDashboardHeader` を追加する。値は以下（JSON 文字列なので改行は `\n` エスケープ）:

    ```markdown
    > [!WARNING]
    > **`## Pending Status Checks` のチェックボックスは押さないこと。** これは供給網 cooldown（`minimumReleaseAge` = 3 日）を意図的にスキップして PR を即作成する操作。non-major は automerge 対象のため、CI 緑でそのまま自動マージまで到達する（→ ADR-20260730-t6e）。承認して PR を作るのは `## Pending Approval` の側。
    > 誤って押した場合は、**次の Renovate 実行までにチェックを外せば無効化できる**。チェックは押した時点では何も起きず、次回実行時に本文から読み直されるだけ。

    This issue lists Renovate updates and detected dependencies. Read the [Dependency Dashboard](https://docs.renovatebot.com/key-concepts/dashboard/) docs to learn more.
    ```

  - `description` 配列に 1 エントリ追加する（「なぜ警告を置くか」のみ。棄却理由は書かない）:
    > `dependencyDashboardHeader` は `## Pending Status Checks` の誤クリック抑止のために置いている。同セクションのチェックボックス（`approvePr-branch=...`）は cooldown（`security:minimumReleaseAgeNpm`）待ちを飛ばして PR を作る操作だが、`dependencyDashboardCheck` は種類を区別しない単一値として下流に流れるため `dependencyDashboardApproval` の分岐も同時に飛ぶ。automerge 導入（→ ADR-20260730-t6e）後は、誤クリック 1 回で二層ゲートが両方無効化され自動マージまで到達しうる。挙動の詳細は `learning/renovate-dependency-dashboard-checkbox-semantics.md`（→ #719）
  - **注意**: `renovate.json` はルート直下の `.json` で pre-commit の `CODE_FILES` 判定（`^(src/|prisma/|[^/]*\.(ts|js|mjs|tsx|jsx)$)`）にマッチせず、lint-staged ごとスキップされる。prettier が走らないのでインデント（2 スペース）と整形は手で合わせる
  - **注意**: `dependencyDashboardHeader` は `template.compile()`（Handlebars）を通る。リテラルの `{{ }}` を書くと展開されるため、後で文言を足す時は注意する
  - ローカル検証: `pnpm dlx --package renovate renovate-config-validator`（CI にも husky にも `renovate.json` の検証は無いため、ここが唯一の事前チェック）
- コミットメッセージ: `ci: Dependency Dashboard に Pending Status Checks 誤クリック抑止の警告を追加`

### Step 2: Renovate Dashboard の挙動を `learning/` に記録

- [ ] **完了**
- 対象ファイル: `learning/renovate-dependency-dashboard-checkbox-semantics.md`（新規）
- テスト戦略: テスト不要（ドキュメント）
- 作業内容: 以下 7 項目を記録する
  1. ダッシュボードのセクション見出しは Renovate 内部のブランチ `result` 値と 1 対 1（全 18 種）。「どのセクションを触ってよいか」で運用を書くと内部モデルと一致して壊れにくい
  2. `dependencyDashboardCheck` は**種類を区別しない単一の truthy 値**として下流に流れ、cooldown（`pendingChecks` / `stabilityStatus`）・`dependencyDashboardApproval`・schedule・branch limit・group size の分岐を**まとめて**飛ばす。誤クリック 1 回で二層ゲートが同時に消える機構的な理由
  3. `processBranch` の早期 return は `pendingChecks` → `dependencyDashboardApproval` の順。よって cooldown 待ちの更新は Pending Approval に現れず、Pending Status Checks にだけ出る
  4. チェック状態は永続化されず、実行のたびに issue body から読み直される（`getCheckedBranches()`）。次回実行前に外せば無効
  5. `internalChecksFilter`（既定 `strict`）はバージョン選択の filter であって表示制御ではない。`none` / `flexible` は cooldown を壊す
  6. `renovate/stability-days` というステータスチェックが存在する（`statusCheckNames.minimumReleaseAge`）。required 化すれば cooldown をマージゲートにできるが、required は**マージ先ブランチ単位**でしか設定できず `renovate/*` に絞れないため、人間の PR がその context を永久に待つ
  7. 事後の復旧：PR ができてしまったら auto-merge を解除する。close しても `PR Closed (Blocked)` セクションの `recreate-branch` で復活できるが、`renovate/react-monorepo` のようなバージョンを含まないグループ名はブランチ名が不変なため、放置すると同じグループが黙って止まり続ける
  - ダッシュボードが**独立した UI ではなく Renovate が書き換え続ける 1 個の GitHub issue** であること（＝ body に手で書いた内容は次回実行で消えるため、`dependencyDashboardHeader` が上書きに耐える唯一の書き込み経路であること）も併記する
- コミットメッセージ: `docs: Renovate Dependency Dashboard のチェックボックス挙動を learning に記録`

### Step 3: PR 作成と適用後の実物確認

- [ ] **完了**
- 対象ファイル: なし（コミット無し）
- テスト戦略: テスト不要（検証作業）
- 作業内容:
  - PR 本文に対策 1〜5 の比較と 2・3・5 の棄却理由を記載する（ADR を立てない代わりの記録先）
  - PR に Renovate の config validation ステータスが付けば二重確認になる
  - **マージ後、次回 Renovate 実行を待って #639 の body を目視確認**:
    - (a) 警告バナーが先頭に描画されているか
    - (b) `## Pending Status Checks` の項目が変わらず残っているか（= 挙動を何も変えていないことの確認）
    - (c) Mend ポータルリンクが消えていないか（消えても復元しない）
- コミットメッセージ: なし
