# ADR-20260707-ae2: 見積申請詳細の操作可否フラグは app層で合成する（query service は操作者非依存）

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-07 |
| 最終更新日 | 2026-07-07 |

## コンテキスト

見積申請詳細の参照クエリ（`GetEstimateApplicationDetail`・#573）は、承認・差戻・取下の操作可否（`canApprove` / `canReject` / `canWithdraw`）を読み取り DTO で供給する。「操作可否を BE が読み取り DTO で供給し、FE に役割メンバーシップ判定を複製させない」方針は canApply（#562・ADR-0069）で確立済みだが、詳細クエリはそれと**判定材料の所在が異なる**。

- `canApply`（一覧・#559）の判定材料は「バリエーションが ACTIVE か」「見積内に前進バリエーションが在るか」で、いずれも **estimate 集約の内側**にある事実。よって `PrismaVariationApplicationStateQueryService` が Prisma 直読みだけで完結できた。
- 兄弟の見積申請一覧検索（`SearchEstimateApplications`・ADR-20260707-b36）も同様に、不変事実の SQL 絞り込み＋ドメイン共有関数での還元が **estimate の Prisma query service に完結**している。

ところが詳細の `canApprove` / `canReject` は「操作者が承認待ちステップの役割メンバーか」（`RoleQueryService.hasMember`）を要し、その判定材料 `EmployeeRole` は **role サブドメインの表**で、estimate 集約から FK を張れない。ドメインにポートを持たせず、集約外の役割グラフはアプリ層のクエリを介して判定する規約（ADR-0030 / ADR-0052）と、既に `ApproveStepCommand` / `RejectStepCommand` / `PreviewApplicationQuery` が `hasMember` を app 層で呼んでいる先例がある。

したがって「詳細の操作可否フラグを一覧クエリと同じく Prisma query service に完結させる」か「app 層で越境合成する」かを決める必要がある。前者は役割サブドメインの表を estimate の infra から直読みすることになり、境界を破る。

## 検討した選択肢

### A. query service 完結（不採用）

`canApply` と同じく、詳細の Prisma query service 内で 3 フラグまで組み立てて DTO を返す。配線は 1 系統で済む。

不採用の理由: `canApprove` / `canReject` の判定には `EmployeeRole`（role サブドメイン）の直読みが要る。これは「集約外の役割グラフはアプリ層で `hasMember` を介して判定する」規約（ADR-0030 / ADR-0052）と、書き込み側（`ApproveStepCommand` 等）の認可経路に反する。読み取りだけ estimate infra から role 表を直読みすると、read/write で認可材料の取得経路が割れ、境界侵犯とドリフトの源になる。

### B. app層で越境合成（採用）

責務を 2 つに割る。

- **query service は操作者非依存**（`findDetail(estimateNumber, variationNumber)`）。Prisma 直読み＋ドメイン共有関数で、表示ビューと還元済みの生事実（`state` / `awaitingRoleId` / `applicantEmployeeId` / `latestApplicationId` / `awaitingStepId` / `expectedVersion`）までを返す。operator を一切知らない。
- **app層 Query が operator を受けて 3 フラグを合成**。`state === PENDING` を共通ゲートに、`canWithdraw = applicantEmployeeId === operator`、`canApprove = canReject = await roleQueryService.hasMember(awaitingRoleId, operator)` を組み立て、最終 DTO を返す。

`PreviewApplicationQuery`（app 層で複数サブドメインのクエリを注入して合成する読み取り）と同型。

## 決定

見積申請詳細の操作可否フラグは app 層 Query で合成し、Prisma query service は操作者非依存の読み取りに保つ（選択肢 B）。

## 根拠

- **境界維持**: 役割メンバーシップ判定を role サブドメインの `hasMember` に閉じ込め、estimate infra が他サブドメインの表を直読みしない。ADR-0030 / ADR-0052 と書き込み側の認可経路に揃う。
- **read/write のドリフト封じ**: 承認/差戻の認可材料（`hasMember`）を読み取りでも同じ経路で引くため、表示可否とコマンド側ガードが同一の真実を見る。
- **判定の一箇所化**: 「操作可否は状態＝申請中が前提」という共通ゲートと 3 フラグの合成が app 層 1 箇所に揃う。`canWithdraw` の本人性判定も（estimate 内で完結する事実ではあるが）app 層に寄せ、フラグ計算を分散させない。
- **テスト分離**: query service を操作者非依存にしたことで、3 フラグの真偽は fake `RoleQueryService` を差した app 層テストで総当りでき、重い Prisma 統合テストは状態導出・表示ビューの検証に集中できる。

不採用（A）の代償は「役割サブドメインの表を estimate infra から直読みする境界侵犯」で、これは配線 1 系統の簡潔さと引き換えにできない。

## 影響

- 詳細クエリは一覧クエリ（`SearchEstimateApplications`・query-service 完結）と**非対称**になる。この ADR はその非対称の理由（詳細の `canApprove` / `canReject` だけが役割サブドメインの `hasMember` を要する）を記録するために起票した。
- app 層 Query は `RoleQueryService` を注入する composition root を要し（`PreviewApplicationQuery` と同型）、query service 単独より配線が 1 系統増える。
- `canApprove` と `canReject` は同一述語（承認待ちステップの役割メンバー かつ 申請中）から算出され、常に一致する。将来この 2 つが分岐する要件が出ても、合成が app 層にあるため query service を触らずに対応できる。
