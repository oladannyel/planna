import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * ESLint flat config.
 *
 * Migrated from `.eslintrc.json` because `@next/eslint-plugin-next` defaults
 * to flat config from Next 16 and ESLint 10 drops legacy config entirely.
 * Every rule below was carried across deliberately — this is a translation,
 * not a reset, and the gate is still `--max-warnings 0`.
 *
 * `next/core-web-vitals` is composed by hand from its constituent plugins
 * rather than `extends`-ed, which flat config does not have.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      ".next/",
      "coverage/",
      "next-env.d.ts",
      "*.config.js",
      "*.config.mjs",
      "free-nextjs-admin-dashboard/",
      // One-off operational scripts, outside the typed project.
      "scripts/**/*.mjs",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ─── Next.js, React, accessibility ──────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
    },
    settings: {
      react: { version: "detect" },
      // Without this, a <label> wrapping one of plAnna's own field components
      // reads as a label with no control, because the rule only recognises
      // native elements.
      "jsx-a11y": {
        components: { Textarea: "textarea", Input: "input" },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["Textarea", "Input"], depth: 3 },
      ],

      // ─── plAnna's own rules ──────────────────────────────────────────────
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          // The legacy config got this from `next/core-web-vitals`, which
          // configured a TypeScript resolver. Flat config does not, so the
          // alias is declared here instead — without it every `@/…` import is
          // unresolvable and sorts to the end, which would have meant
          // reshuffling the imports of 30 files to satisfy the linter.
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc" },
          "newlines-between": "always",
        },
      ],
    },
  },

  // Config files legitimately default-export.
  {
    files: ["*.config.ts", "vitest.setup.ts"],
    rules: { "import/no-default-export": "off" },
  },

  // Tests mock untyped shapes on purpose; the type-safety rules would force
  // casts that obscure what the test is actually asserting.
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
);
