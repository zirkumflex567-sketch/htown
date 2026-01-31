module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-console': 'off'
  }
};
