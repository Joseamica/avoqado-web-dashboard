import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
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
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Disable in favor of unused-imports
      // Auto-fixable unused imports detection
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
      ],
      // Workaround for ESLint 9 + @typescript-eslint interaction on no-unused-expressions
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true }],
      '@typescript-eslint/no-explicit-any': 'off',

      // Enforce canonical service import path
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/services/superadmin',
              message: "Use '@/services/superadmin.service' instead of the compatibility wrapper.",
            },
          ],
          patterns: [
            {
              group: ['@/contexts/*'],
              message: "Use '@/context/*' (singular) for context modules.",
            },
          ],
        },
      ],

      // Prevent hardcoded gray colors in className and enforce i18n for user-visible strings
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
        },
        {
          selector: 'ImportDeclaration[source.value="@/lib/theme-utils"]',
          message: '🚨 THEME VIOLATION: Do not use old themeClasses from theme-utils. Use CSS variables (text-foreground, bg-card, etc.) or useThemeClasses() hook. See THEME-GUIDELINES.md'
        },
        {
          selector: 'MemberExpression[object.name="themeClasses"]',
          message: '🚨 THEME VIOLATION: Do not use old themeClasses. Use CSS variables (text-foreground, bg-card, etc.) or useThemeClasses() hook. See THEME-GUIDELINES.md'
        },
        // Prevent hardcoded /venues/ paths in navigation - use fullBasePath from useCurrentVenue()
        // Note: This matches template strings containing both "venues" and "${venue" or "${venueslug"
        {
          selector: 'TemplateElement[value.raw=/venues.*\\$\\{venue/i]',
          message: '🚨 WHITE-LABEL VIOLATION: Use `fullBasePath` from useCurrentVenue() instead of hardcoded /venues/ paths. This breaks white-label mode (/wl/:slug). See CLAUDE.md Rule #14.'
        }
      ]
    },
  },
)
