// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const formatjs = require("eslint-plugin-formatjs").default;

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [".expo/**", "dist/*"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { formatjs },
    rules: {
      "formatjs/enforce-description": ["error", "literal"],
      "formatjs/enforce-default-message": ["error", "literal"],
      "formatjs/no-id": "error",
      "formatjs/no-invalid-icu": "error",
      "formatjs/enforce-placeholders": "error",
      "formatjs/prefer-full-sentence": "warn",
    },
  },
]);
