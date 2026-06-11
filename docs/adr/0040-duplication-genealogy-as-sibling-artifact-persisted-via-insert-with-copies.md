# ADR-0040: 見積複製の系譜(EstimateVariationCopy)を集約外の兄弟成果物として扱い insertWithCopies でアトミック永続化する

| 項目 | 値 |
|---|---|
| ステータス | 採用 |
| 起票日 | 2026-06-11 |
| 最終更新日 | 2026-06-11 |

## コンテキスト

C6 DuplicateEstimate は、複製元 Estimate と新 Estimate という**別々の集約インスタンス**にまたがる操作である。系譜 `EstimateVariationCopy` は「複製先バリエーション → 複製元バリエーション」を指す関連で、**どちらの集約インスタンスにも属さない**（複製先 variation を `copiedVariationId`、複製元 variation を `sourceVariationId` で参照）。

一方、見積の編集系コマンド（C2〜C5）は系譜を一切必要とせず、「複製元を表示」は読み取りモデル（QueryService/DTO）側の関心事である。書き込みモデルの集約（`findById` で再構築）は編集可能な状態だけを保持したい。また本プロジェクトはトランザクションをリポジトリ内部に閉じ込めており（アプリ層から `tx` を渡す Unit of Work は無い）、新 Estimate と系譜は同一トランザクションで保存する必要がある。

## 検討した選択肢

### A. 系譜を集約外の兄弟成果物とし、`insertWithCopies(estimate, copies)` で永続化（採用）

ドメインサービスが `{ estimate, copies }` を返し、`EstimateRepository.insertWithCopies` が 1 トランザクションで新 Estimate と `estimate_variation_copies` を書き込む。系譜の `copiedVariationId` はすべて新集約のバリエーションを指すため、書き込みは新集約と同一トランザクションで完結し、複製元へは id 参照のみ（書き込みなし）。

### B. 系譜を新 Estimate 集約の一部として保持し `insert` で永続化（不採用）

複製先バリエーションが「出自ポインタ」を持つと見なし集約内に含める案。`insert(estimate)` だけで完結し新リポジトリメソッド不要だが、集約の再構築（`findById`）時に系譜をロードして整合させる義務が生じる。編集系コマンドでは不要なのに書き込みモデルを汚す。

### C. 別リポジトリ `EstimateVariationCopyRepository` + アプリ層 Unit of Work（不採用）

最も DDD 的に純粋だが、リポジトリをまたぐトランザクション文脈の受け渡し機構を新規導入する必要があり、それ自体が大きなアーキテクチャ変更でスコープ過大。

## 決定

A を採用する。系譜は集約外の兄弟成果物とし、`EstimateRepository.insertWithCopies(estimate, copies)` で新 Estimate と系譜を 1 トランザクションでアトミックに永続化する。

## 根拠

書き込みモデルの集約を「編集可能な状態」だけに保ち、書き込み専用・読みは読み取りモデルという系譜の性質を再構築側に持ち込まない。スキーマの分離意図（系譜は別テーブル、見積・バリエーション本体に複製元の列を持たない）と整合する。リポジトリがトランザクション所有者という既存構成の枠内でアトミック性を確保でき、UoW の新規導入を避けられる。

## 影響

- `EstimateRepository` に集約ルート以外（系譜）を引数に取るメソッド `insertWithCopies` が入る。集約ルートごとに 1 リポジトリの原則の例外的拡張だが、系譜が新集約と同一トランザクションで保存される必然性から正当化する。
- 「複製元を表示」する読み取り側 UI は読み取りモデル（QueryService）で `estimate_variation_copies` を JOIN して別途実装する（本 issue スコープ外）。
- 系譜の表現は [ADR-0041](0041-variation-copy-natural-key.md) で値オブジェクト + 自然キーとする。
