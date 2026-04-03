import { roleBaseSchema } from "../_shared/schema";

/**
 * 役割更新用スキーマ
 * roleCd, positionId は不変のため含まない
 */
export const updateRoleSchema = roleBaseSchema;
