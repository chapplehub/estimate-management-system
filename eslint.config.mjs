import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Documentation
    "docs/**",
    "learning/**",
    // Tool configurations
    ".claude/**",
    ".serena/**",
    ".husky/**",
    // Generated files
    "generated/**",
    "coverage/**",
    // Test artifacts
    "test-results/**",
    "playwright-report/**",
  ]),
  // Custom rules
  {
    rules: {
      // _で始まる変数は未使用でも許可（分割代入で除外する際に使用）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
