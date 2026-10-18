import js from "@eslint/js";
import tseslint from "typescript-eslint";

const moduleImports = {
  paths: [
    { name: "pg", message: "Use ctx.db; no raw database clients in modules.", allowTypeImports: true },
    { name: "postgres", message: "Use ctx.db; no raw database clients in modules." },
    { name: "kysely", message: "Use ctx.db; kysely types only.", allowTypeImports: true },
    { name: "@homegrown/core/testing", message: "Test helpers belong in tests/." },
  ],
  patterns: [
    { group: ["@homegrown/mod-*"], message: "Call other modules through ctx.modules (declared in module.json)." },
    { regex: "^\\.\\./\\.\\./(?!\\.)", message: "No imports across module folders; use ctx.modules." },
    { group: ["**/core/src/*", "**/core/bin/*"], message: "Import @homegrown/core, never core internals." },
  ],
};

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.generated/**", ".homegrown/**", "apps/web/public/sw.js", "artifacts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  { files: ["**/*.mjs"], languageOptions: { globals: { process: "readonly" } } },
  {
    files: ["apps/*/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/**"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": ["error", moduleImports],
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/\\bcore\\.(members|events|flags|migrations)\\b|\\blogs\\.logs\\b/]", message: "Core tables are off-limits; identity comes from ctx.auth.currentMember()." },
      ],
    },
  },
);
