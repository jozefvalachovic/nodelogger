// @ts-check

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-namespace": "off",
    "no-case-declarations": "off",
  },
  overrides: [
    {
      files: ["src/hooks.ts"],
      rules: {
        // Disable for hooks file since we don't have the react-hooks plugin
        "no-unused-vars": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules", "*.js"],
};
