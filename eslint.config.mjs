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
      // 集約境界規約: Estimate 集約の子エンティティへの集約外からの直接 import を禁止する。
      // バレル (@subdomains/estimate/domain/entities) 経由で集約ルート Estimate のみ
      // 公開する。同 entities ディレクトリ内の相対 import（隣接テスト等）は別オーバーライド
      // で許可する。
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@subdomains/estimate/domain/entities/EstimateVariation",
                "@subdomains/estimate/domain/entities/EstimateItem",
                "@subdomains/estimate/domain/entities/RepairEstimateDetail",
                "@subdomains/estimate/domain/entities/AfterRepairEstimateDetail",
                "@subdomains/estimate/domain/entities/RevisedEstimateItemDetail",
                "@subdomains/estimate/domain/entities/approval/EstimateApprovalStep",
              ],
              message:
                "Estimate / EstimateApplication 集約の子エンティティは集約外から直接 import できません。集約ルート（@subdomains/estimate/domain/entities）経由で操作してください。",
            },
          ],
        },
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
  // 集約内（entities ディレクトリ内）の隣接ファイル・テストは相対 import を許可する。
  // バレル経由必須化は「集約外コード」に対する規約なので、集約内自身（Estimate.ts や
  // EstimateVariation.ts、その __tests__）は子エンティティを参照できる必要がある。
  {
    files: ["src/server/subdomains/estimate/domain/entities/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // EstimateMapper は永続化からの集約再構築（reconstitution）という infrastructure の
  // 正当な責務を担うため、子エンティティの static reconstruct() を直接呼ぶ必要がある。
  // 集約境界規約の「正当な例外」としてこの単一ファイルに限り直接 import を許可する。
  // （例外をディレクトリ全体に広げず1ファイルに閉じ込め、穴の増殖を防ぐ）
  {
    files: ["src/server/subdomains/estimate/infrastructure/mappers/EstimateMapper.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // EstimateApplicationMapper も同様に永続化からの集約再構築のため、子エンティティ
  // EstimateApprovalStep の reconstruct() を直接呼ぶ。承認免除（EstimateApprovalExemptionMapper）は
  // 子を持たない薄い集約のため override 不要で、本ファイルのみに穴を限定する。
  {
    files: [
      "src/server/subdomains/estimate/infrastructure/mappers/approval/EstimateApplicationMapper.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
