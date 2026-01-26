import { z } from "zod";
import {
  employeeBaseSchema,
  employeeCdSchema,
  passwordSchema,
} from "../_shared/schema";

/**
 * 従業員作成フォームのバリデーションスキーマ
 * 基盤スキーマ + employeeCd + password + departmentId
 */
export const createEmployeeSchema = employeeBaseSchema.extend({
  employeeCd: employeeCdSchema,
  password: passwordSchema,
  departmentId: z
    .string({ error: "部署を選択してください" })
    .min(1, "部署を選択してください"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
