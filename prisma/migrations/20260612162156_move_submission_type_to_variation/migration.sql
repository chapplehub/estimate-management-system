-- 提出区分（submission_type）を estimates から estimate_variations へ移動する（ADR-0045 / #320）
--
-- Prisma 自動生成ではなく手書き。理由: NOT NULL 列の追加に業務的に正しいデフォルト値が
-- 存在しないため、nullable 追加 → 親見積からバックフィル → NOT NULL 化の 3 段階を要する。
-- PostgreSQL の DDL はトランザクショナルであり、本マイグレーション全体がアトミックに適用される。

-- 1. nullable で列を追加
ALTER TABLE "estimate_variations" ADD COLUMN "submission_type" "SubmissionType";

-- 2. 親見積の提出区分をバックフィル
UPDATE "estimate_variations" ev
SET "submission_type" = e."submission_type"
FROM "estimates" e
WHERE ev."estimate_id" = e."id";

-- 3. NOT NULL 化（デフォルトは付けない: 作成時に明示必須）
ALTER TABLE "estimate_variations" ALTER COLUMN "submission_type" SET NOT NULL;

-- 4. 旧列・旧 index を撤去
--    index は移設しない（ADR-0045: 2値 enum の単独 index は実用せず、利用クエリも現存しない）
DROP INDEX "estimates_submission_type_idx";
ALTER TABLE "estimates" DROP COLUMN "submission_type";
