const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "type-enum": [
      2,
      "always",
      [
        // @commitlint/config-conventional defaults
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
        // custom
        // 依存更新は chore(deps) を使う（Renovate の :semanticCommitTypeAll(chore)）。
        // deps type は追加しない
        "agent",
      ],
    ],
  },
};

export default config;
