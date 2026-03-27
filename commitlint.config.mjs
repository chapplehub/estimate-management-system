const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [2, "never", ["upper-case"]],
  },
};

export default config;
