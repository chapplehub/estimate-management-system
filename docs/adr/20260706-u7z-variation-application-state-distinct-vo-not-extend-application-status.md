# ADR-20260706-u7z: バリエーション申請状態を6値の別ドメインVOで表し、`ApplicationStatus`(4値)を拡張しない

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-07-06 |
| 最終更新日 | 2026-07-06 |

## コンテキスト

#493 で、見積詳細画面（S2）の「申請ボタン出し分け」と「バリエーション別バッジ」を駆動する参照系クエリ（`GetVariationApplicationStatesQuery`）を実装する。この読み取りは、バリエーション1件ごとに「申請の観点で今どの状態か」を**1値**で返す必要があり、取りうる値は6つある。

- 未申請（NONE）／申請中（PENDING）／差戻（REJECTED）／取下（WITHDRAWN）／承認済（APPROVED）／承認不要＝免除（EXEMPTED）

一方、既存の `ApplicationStatus` VO は **4値**（PENDING / APPROVED / REJECTED / WITHDRAWN）で、これは *1つの申請*（`EstimateApplication`）の導出状態を、終端イベント行の存在から導いたもの（ADR-0058・§3.6）である。6値のうち差分の2つ——**NONE**（申請行が1件も存在しない）と **EXEMPTED**（別集約 `EstimateApprovalExemption` 由来の承認免除・ADR-0054）——は、そもそも「申請の状態」ではない。

ADR-0069 は「境界の状態語彙は code＋label を両載せし、**コード集合はドメイン VO を単一ソースとする**（VO の `VALID_VALUES as const` から code 型を export）／FE は直 type-import」と定める。よって、この6値 code の単一ソースを**どこに置くか**を決める必要がある。#493 起票時の原文は「`ApplicationStatusCode` を `ApplicationStatus.VALID_VALUES` から export して DTO の `code` に使う」としていたが、4値の VO では6値を賄えず内部矛盾していた。本 ADR はこの置き場所を確定する。

## 検討した選択肢

### X. 6値の別ドメインVO `VariationApplicationState` を新設し、`ApplicationStatus`(4値)を再利用する（採用）

`ApplicationStatus`(4値) は据え置き、それを再利用しつつ NONE / EXEMPTED を足した6値の**別 VO** `VariationApplicationState` を `domain/values/approval` に新設する。主語は*バリエーション*。

- code 集合（6値）と label の単一ソースをこの VO が持つ。申請と重なる4値の label は `ApplicationStatus.label` へ委譲し、NONE=「未申請」/ EXEMPTED=「承認不要」のみ自前で持つ。
- `isAdvancing()` は CONTEXT「前進バリエーション（申請中・承認済・免除）」と 1:1（PENDING / APPROVED / EXEMPTED → true）。
- バリエーション単位の畳み込み（免除最優先 → 最新 attempt → 未申請）の**還元先**がこの VO になり、前進判定は `.isAdvancing()`、バッジは `.code` / `.label` で読める。

### X'. `ApplicationStatus` 自体を6値に拡張する（不採用）

既存の `ApplicationStatus` に NONE / EXEMPTED を足して6値にする。

- `EstimateApplication.applicationStatus` getter は構造上 **4値しか返せない**（`EstimateApplication` が存在する＝申請が存在するので NONE は返せず、免除は別集約なので EXEMPTED も返せない）。戻り型を6値に広げると「決して返さない2値」を型で約束し、網羅 switch に死に枝が生える。書き込みモデルの「不正状態を表現不能」という強みが緩む。
- `isAdvancing()` が EXEMPTED→true を持つことになり、*申請*の VO が*承認免除*の意味論を抱える（CONTEXT が別概念として厳密に分けているのに漏れる）。
- 未申請/免除を表すには申請が無いのに `ApplicationStatus` を構築する必要があり、「存在しない申請の申請状態」という自己矛盾した名前になる。

### Y. 読み取り層の union 型として合成する（不採用）

`type VariationApplicationStateCode = ApplicationStatusCode | "NONE" | "EXEMPTED"` を DTO ファイル（application 層）に置く（既存の `RevisionRole` / `EstimateDisplayStatus` と同じ流儀）。ドリフトしやすい4値は VO 由来の `ApplicationStatusCode` を参照し、読み取り専用の2値だけ読み取り層で足す。

- FE/BE のドリフト防止（ADR-0069）は満たす。だが CONTEXT 語彙「バリエーション申請状態」に **code＋label の単一ソースの実体**を与えられず、`isAdvancing()` や畳み込みといった**振る舞いが型に宿らない**。前進判定・畳み込み・バッジ表示を1つの VO へ一本化する利点（下記「根拠」）を捨てることになる。

## 決定

**選択肢 X を採用する。** バリエーション単位の申請観点状態を、`ApplicationStatus`(4値)を拡張せずに再利用する**新6値ドメインVO `VariationApplicationState`** として持つ。`ApplicationStatus` は1申請の導出状態を表す4値の VO のまま据え置く。

## 根拠

- **主語が違う**。`ApplicationStatus` は *1つの申請* の状態、`VariationApplicationState` は *バリエーション* の状態。NONE（未申請）は申請の不在、EXEMPTED（免除）は別集約 `EstimateApprovalExemption`（ADR-0054）の事実であり、いずれも「バリエーションの状態」であって「申請の状態」ではない。主語で型を分けることで `EstimateApplication.applicationStatus` は4値のまま「不正状態を表現不能」を保てる。
- **`isAdvancing()` が主語に対して正直になる**。`VariationApplicationState.isAdvancing()` は CONTEXT の「前進バリエーション」と 1:1。`ApplicationStatus` に EXEMPTED を混ぜると（X'）、申請 VO が承認免除の意味論を抱える漏れが生じる。
- **ADR-0069 を最も素直に満たす**。6値 code＋label の単一ソースが1つの VO になり、FE は `VariationApplicationStateCode` を直 type-import で消費できる。重なる4値の label は `ApplicationStatus.label` へ委譲するため、ラベルもドリフトしない。
- **畳み込み・前進判定・バッジ表示が1つの VO に集約する**。バリエーション単位の還元先・前進判定（`.isAdvancing()`）・表示（`.code` / `.label`）を同一 VO が担い、命令側（前進ガード）と読み取り側（canApply・バッジ）が同じ VO に乗る。
- **X' 不採用**: 上記のとおり getter の戻り型が偽り（死に枝）になり、申請 VO に免除意味論が漏れ、書き込みモデルの不変条件が緩む。
- **Y 不採用**: 読み取り union でもドリフトは防げるが、CONTEXT 語彙に実体 VO を与えられず、振る舞いが型に宿らないため還元一本化の利点を失う。「読み取り専用の合成をドメイン VO にするのは過剰では」という反論はあるが、`ApplicationStatus` 自身が docstring で「読み取りモデルが結果を型で表現するためのメモリ上の VO」と自認しており、読み取り寄与の VO をドメインに置く前例が既にある。

## 影響

- **重なる状態 VO が2つ共存する**（4値 `ApplicationStatus` / 6値 `VariationApplicationState`）。将来の読者に「なぜ2つ・なぜ片方を拡張しなかったのか」という疑問が生じるが、答えは「主語が申請かバリエーションか」であり、本 ADR がその根拠を残す。
- 重なる4値の label は `ApplicationStatus.label` へ委譲＝ラベルの単一ソースを維持。`VariationApplicationState` が自前で持つのは NONE / EXEMPTED の label のみ。
- 免除の表示語は「承認不要」に統一する（表示ステータスと同一の免除事実に表示語を割らない・CONTEXT「バリエーション申請状態」）。
- FE は `VariationApplicationStateCode` と DTO を直 type-import で消費（ミラー禁止・ADR-0069）。
- read/write のドリフト封じ（§3.6 導出の純粋関数共有・前進述語の共有）は本 ADR のスコープ外だが密接に関連する（#493 の実装判断として別途）。

## 関連

- ADR-0069（FE は BE の DTO を直 type-import・code＋label は VO 単一ソース・本 ADR の親規約）
- ADR-0058（申請状態を終端イベント行の存在から導出・`ApplicationStatus` の4値の出自）
- ADR-0054（承認免除を専用テーブルで表現＝EXEMPTED が申請とは別集約由来である根拠）
- CONTEXT.md「バリエーション申請状態」「前進バリエーション」「承認免除」「表示ステータス」
