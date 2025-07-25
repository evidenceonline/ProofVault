module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Customize rules as needed
    'no-console': 'off', // Allow console statements in Node.js
    'camelcase': 'off', // Database fields often use snake_case
    'prefer-const': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }]
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      },
      rules: {
        'no-undef': 'off'
      }
    }
  ]
};