# 公開デモ環境の初期データ投入

公開デモ環境（[ADR-20260821-4f1](../adr/20260821-4f1-deploy-target-is-public-demo-reuse-dev-seed.md)）へ初期データを投入する手順（Issue #765）。

> [!CAUTION]
> **この操作は破壊的**。seed は全テーブルを `deleteMany` してから作り直すため、既存データは残らない。
> 何度実行しても同じ結果になる代わりに、投入済みの内容は毎回失われる。

`up -d` では seed は走らない（`profiles: ["seed"]` で除外している）。
**初回デプロイ後にこの手順を叩き忘れると、DB が空のままのアプリが公開される。**

## 手順

`scripts/deploy.sh`（または `scripts/deploy-apply.sh`）が成功した状態から始める。以下の 4 コマンドを順に実行する。

```bash
# 0. HEAD 由来のイメージタグを環境変数に載せる（省くと seed は latest で走る）
eval "$(scripts/deploy-env.sh)"

# 1. アプリだけ停止する（db は止めない。seed の接続先なので）
docker compose -f compose.prod.yaml --env-file .env.production stop app

# 2. seed を1回だけ実行する（--profile seed が無いと「サービスが無い」と言われる）
docker compose -f compose.prod.yaml --env-file .env.production --profile seed run --rm seed

# 3. アプリを再開する
docker compose -f compose.prod.yaml --env-file .env.production start app
```

### 各コマンドの意味

0. **`eval "$(scripts/deploy-env.sh)"`** — クローンの HEAD commit から `MIGRATE_IMAGE`（と `APP_IMAGE`）を導出してシェルに載せる。seed は migrate イメージに相乗りしており、これが無いと compose の既定値 `latest` で走る。ロールバック後の「作り直し」（[deploy.md](deploy.md) 5.2）で seed する場面では、`latest` だと**旧スキーマに最新の seed が走って落ちる**。常に付ける
1. **`stop app`** — seed の `deleteMany` は 1 トランザクションに包まれておらず、実行中は「一部テーブルだけ空」の中間状態が外から読める。それを見せないためにアプリを止める。止めている間 `http://localhost` は Nginx が **502** を返すが、これは正常
2. **`--profile seed run --rm seed`** — 初期データ投入の本体。`--profile seed` は必須（`up -d` で誤爆しないよう seed サービスを profile で隔離しているため）。`run --rm` は 1 回実行してコンテナを捨てる指定
3. **`start app`** — 再開。数秒で healthy に戻る

## 投入される内容

- 完了時に**ログインアカウント一覧**が出力される（`employee1@example.com` 〜、共通パスワードも表示される）
- 先頭 26 件が役職・役割の決まった固定アカウント。残りはランダム生成
- 所要時間はローカル実測で 300 人 2.2 秒 / 2000 人 12 秒

## 環境変数

`.env.production` の任意キー。未設定なら seed 内の既定値を使う。空値（`KEY=`）は未設定として扱われる。

| キー | 既定値 | 内容 |
| --- | --- | --- |
| `SEED_DEFAULT_PASSWORD` | seed 内の定数 | デモアカウント共通のパスワード。**未設定だとリポジトリに書かれた既定値がそのまま実環境の値になる** |
| `SEED_TOTAL_EMPLOYEES` | 2000 | 生成するダミー従業員数。**26 未満は不可** |

`SEED_TOTAL_EMPLOYEES` が 26 未満だと、固定ログインアカウント 26 件を下回るため固定課員が作られず、見積 seed が前提不足で落ちる。
範囲外の値は `deleteMany` に到達する前に例外で止まるので、DB が壊れることはない。

## イメージ

seed は専用イメージを持たず `migrate` イメージに相乗りしている（`command` を `tsx prisma/seed-dev.ts` に上書き）。
専用の `*_IMAGE` 変数は無いため、**`MIGRATE_IMAGE` を指定していればそれがそのまま seed に使われる**。
手順 0 の `scripts/deploy-env.sh` がその値を HEAD から導出するので、手で指定する必要は無い（`.env.production` に書いてはならない。[deploy.md](deploy.md) 3 章）。
