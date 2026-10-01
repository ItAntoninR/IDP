// @ts-check
import prettier from "eslint-config-prettier";
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    ignores: ["server/lib/db/migrations/**"],
  },

  // Désactive les règles de mise en forme gérées par Prettier.
  prettier,

  {
    files: ["**/*.vue"],
    rules: {
      // Une ligne vide entre chaque balise sœur du template.
      "vue/padding-line-between-tags": ["error", [{ blankLine: "always", prev: "*", next: "*" }]],
      // Une ligne vide entre <script>, <template> et <style>.
      "vue/padding-line-between-blocks": ["error", "always"],
      "vue/block-order": ["error", { order: ["script", "template", "style"] }],
      "vue/component-name-in-template-casing": ["error", "PascalCase", { registeredComponentsOnly: false }],
      "vue/attributes-order": ["error", { alphabetical: false }],
      "vue/no-unused-refs": "error",
      "vue/no-useless-v-bind": "error",
      "vue/prefer-true-attribute-shorthand": "error",
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
    },
  },

  {
    rules: {
      // Aère le code : lignes vides autour des blocs, avant les return, après les déclarations.
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "always", prev: "*", next: ["function", "class", "export"] },
        { blankLine: "always", prev: ["function", "class", "block-like"], next: "*" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
      ],
      curly: ["error", "multi-line"],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  {
    files: ["**/*.ts", "**/*.vue"],
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-dynamic-delete": "off",
    },
  },
);
