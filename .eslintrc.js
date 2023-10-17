/*
 * @Description: ^_^
 * @Author: sharebravery
 * @Date: 2022-12-08 17:23:01
 */
module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ['@antfu', 'eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/semi': 0,
    'no-console': 0,
    'no-throw-literal': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    'antfu/if-newline': 0,
    'no-sequences': 0,
  },
  ignorePatterns: ['node_modules/', 'lib/'],

};
