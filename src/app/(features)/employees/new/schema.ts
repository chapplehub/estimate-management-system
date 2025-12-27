import { z } from "zod";
import {
  employeeBaseSchema,
  employeeCdSchema,
  passwordSchema,
} from "../_shared/schema";

/**
 * 従業員作成フォームのバリデーションスキーマ
 * 基盤スキーマ + employeeCd + password
 */
export const createEmployeeSchema = employeeBaseSchema.extend({
  employeeCd: employeeCdSchema,
  password: passwordSchema,
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
