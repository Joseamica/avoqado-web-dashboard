import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',

      // Prevent hardcoded gray colors in className
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/.*(?:text-gray-|bg-gray-|border-gray-).*/]',
          message: '🚨 THEME VIOLATION: Use theme-aware colors instead of hardcoded gray colors. See THEME-GUIDELINES.md'
        },
        {
          selector: 'TemplateElement[value.raw=/.*(?:text-gray-|bg-gray-|border-gray-).*/]',
          message: '🚨 THEME VIOLATION: Use theme-aware colors instead of hardcoded gray colors. See THEME-GUIDELINES.md'
        },
        {
          selector: 'Literal[value=/.*(?:text-black|text-white|bg-black|bg-white).*/]',
          message: '🚨 THEME VIOLATION: Use text-foreground/bg-background instead of hardcoded black/white colors. See THEME-GUIDELINES.md'
        }
      ]
    },
  },
)
