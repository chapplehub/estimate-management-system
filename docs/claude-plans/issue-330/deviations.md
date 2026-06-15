# Issue #330 実装計画からの逸脱記録

実装計画: [estimate-detail-read-view.md](./estimate-detail-read-view.md)

## 1. セット群を seed / E2E から除外し S5 へ先送り（Step 6・Step 7）

- **元の計画内容**: Step 6 の seed と Step 7 の E2E に「セット群＋構成明細」を含め、E2E で
  セット群導出金額を検証する。
- **実際の実装内容**: seed / E2E からセット群を除外した。seed は複数バリ・提出区分両方・改訂価格・
  明細値引・全体値引・無効バリ・全無効までを含み、E2E はタブ切替・提出区分バッジ・改訂価格・
  無効状態・全無効警告・404 を検証する。
- **逸脱の理由**: セット群を構成する公開ドメイン経路が現時点で存在しない。`EstimateFactory.create`
  に setGroups 記述子が無く、`Estimate` / `EstimateVariation` にもセット群の mutator が無い
  （S1 は永続化・読み取りのみ実装）。セット群を作れるのは集約内テストビルダー（reconstruct/create）
  か raw Prisma のみ。ユーザー判断により、セット群の authoring は S5（セット編集スライス）へ
  先送りとした。ADR-0047 の導出（amount=Σ・sortOrder=min・入れ子・非交錯）は query 結合テスト
  （実 DB・cycle 3）で自動検証済みのため、自動テストの穴は生じない。ブラウザ描画の確認のみ S5 へ繰越。

## 2. seed の書き込み経路を repository.save() から EstimateMapper + seed 自身の client へ（Step 6）

- **元の計画内容**: Q8 に従い「EstimateFactory ＋ 集約操作 ＋ PrismaEstimateRepository.save()」で
  整合データを作る。
- **実際の実装内容**: `EstimateFactory.create`（集約構築・deactivateVariation 等の集約操作）→
  `EstimateMapper.toEstimateCreateInput`（Prisma 入力へ変換）→ 各 seed 自身の `PrismaClient`
  （seed.ts=.env / seed-e2e.ts=.env.test）で `prisma.estimate.create` する経路にした。
- **逸脱の理由**: `PrismaEstimateRepository` は `@server/prisma` シングルトンを使い、これは seed が
  読み込む DB（dev / test）と別の接続・env を指すため、seed から repository を呼ぶと書き込み先 DB が
  食い違う。金額・集計はドメイン（factory 経由の LineItemAmountPolicy / EstimateAmountPolicy）が
  導出するので、Q8 の趣旨（raw 金額の二重実装によるドリフト回避）は保たれている。

## 3. 改訂の表現を reviseForCustomer ではなく明細スナップショットで（Step 6）

- **元の計画内容**: 「改訂バリ＋revisedDeliveryPrice」を含める。
- **実際の実装内容**: `EstimateItemDescriptor.revisedDeliveryPrice` を直接指定し、明細に
  `RevisedEstimateItemDetail`（deliveryPrice スナップショット）を持たせた。`reviseForCustomer`
  による改訂系譜は作らない。
- **逸脱の理由**: S2 は系譜ラベル（改訂元/複製元）を表示しない（Q10・S6 先送り）。表示に必要なのは
  明細の改訂価格（§8.4）のみで、これは revisedDetail スナップショットで足りる。`reviseForCustomer`
  経由にすると改訂系譜（EstimateVariationRevision）の永続化が必要になり（insert は系譜を書かない）、
  S2 で不要な複雑さを持ち込むため避けた。
