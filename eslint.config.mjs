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
    // Config files (not in tsconfig)
    "*.config.mjs",
    "*.config.ts",
    ".lintstagedrc.mjs",
    // Auto-generated UI components (shadcn/ui)
    "src/app/_components/shadcnui/**",
  ]),
  // Enable type-aware linting
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Custom rules
  {
    rules: {
      // _で始まる変数は未使用でも許可（分割代入で除外する際に使用）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Naming convention rules (based on typescript-eslint recommendations)
      "@typescript-eslint/naming-convention": [
        "error",
        // Default: camelCase
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // Variables: camelCase, UPPER_CASE, or PascalCase (for React components)
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
        // Parameters: camelCase
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // Functions: camelCase or PascalCase (for React components)
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        // Types (class, interface, type, enum): PascalCase
        // TODO: Add I prefix prohibition after refactoring existing interfaces
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Enum members: PascalCase or UPPER_CASE
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        // Class properties: camelCase or UPPER_CASE (for constants)
        {
          selector: "classProperty",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Object literal properties: camelCase or UPPER_CASE (for const objects)
        {
          selector: "objectLiteralProperty",
          format: ["camelCase", "UPPER_CASE"],
        },
        // Type properties: camelCase or UPPER_CASE (allow _ prefix for branded types)
        {
          selector: "typeProperty",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        // Imports: camelCase or PascalCase
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],
    },
  },
  // Disable naming-convention for test files and form components
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "src/app/_components/form/**"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },
]);

export default eslintConfig;
