import next from "eslint-config-next";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  // Next.js recommended rules
  ...next(),

  // Prettier integration:
  // 1) turn off ESLint rules that fight Prettier
  prettierConfig,

  // 2) run Prettier as an ESLint rule (so ESLint "fix" formats your code)
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      "prettier/prettier": "error"
    }
  }
];
