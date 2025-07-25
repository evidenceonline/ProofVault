module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly',
    jsPDF: 'readonly'
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': ['warn'],
    'prefer-const': ['error'],
    'no-var': ['error'],
    'object-shorthand': ['error'],
    'prefer-arrow-callback': ['error'],
    'arrow-spacing': ['error'],
    'no-multiple-empty-lines': ['error', { max: 2 }],
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'never'],
    'keyword-spacing': ['error'],
    'space-infix-ops': ['error'],
    'eol-last': ['error'],
    'no-trailing-spaces': ['error']
  }
};