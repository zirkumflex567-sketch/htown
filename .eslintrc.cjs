module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:import/recommended", "prettier"],
  env: {
    es2022: true,
    browser: true,
    node: true
  },
  settings: {
    "import/resolver": {
      typescript: true
    }
  },
  rules: {
    "import/no-unresolved": "off"
  }
};
