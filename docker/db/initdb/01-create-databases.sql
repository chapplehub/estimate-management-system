-- 単体テスト（Issue #584）・E2E テスト用の DB を初回起動時に作成する。
-- postgres イメージの POSTGRES_DB では 1 つの DB しか作れないため、残り 2 つをここで作る。
-- scripts/unit-setup.ts / e2e-setup.ts の createdb は "already exists" 分岐に入るので無改修で共存できる。
CREATE DATABASE estimate_management_unit OWNER dev_user;
CREATE DATABASE estimate_management_e2e OWNER dev_user;
