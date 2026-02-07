import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint from 'typescript-eslint'

// Custom local rules
import noHardcodedVenuePaths from './eslint-rules/no-hardcoded-venue-paths.js'
import noMissingTranslationKeys from './eslint-rules/no-missing-translation-keys.js'

// Local plugin for custom rules
const localPlugin = {
  rules: {
    'no-hardcoded-venue-paths': noHardcodedVenuePaths,
    'no-missing-translation-keys': noMissingTranslationKeys,
  },
}

export default tseslint.config(
  { ignores: ['dist', '**/*.json', '**/*.svg'] },
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
      'local': localPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Disable in favor of unused-imports
      // Auto-fixable unused imports detection
      'unused-imports/no-unused-imports': 'warn',
      // Industry-standard unused vars config (Airbnb, Vercel, Next.js pattern)
      // All underscore-prefixed variables are ignored: _error, _unused, etc.
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',        // Allows: catch (_error) { ... }
          destructuredArrayIgnorePattern: '^_',   // Allows: const [_first, second] = arr
          ignoreRestSiblings: true,               // Allows: const { id, ...rest } = obj (id unused)
        }
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
      ],

      // Custom local rules
      'local/no-hardcoded-venue-paths': 'error',
      // Translation key validation: ERROR by default, forces proper i18n patterns
      'local/no-missing-translation-keys': ['error', {
        validateAgainstJson: false, // Set to true to validate against JSON files
        ignoredPrefixes: ['zod.', 'error.'],
      }],
    },
  },
  // Override: Superadmin files are excluded from i18n requirements
  // These are Control Plane pages hardcoded in Spanish (only used by internal team)
  {
    files: ['**/Admin/**', '**/Superadmin/**', '**/*superadmin*', '**/*Superadmin*'],
    plugins: {
      'local': localPlugin,
    },
    rules: {
      // Disable translation key validation - Superadmin pages are hardcoded in Spanish
      'local/no-missing-translation-keys': 'off',
    },
  },
  // Override: PlayTelecom pages are excluded from theme/i18n rules
  // This is a separate/legacy module that doesn't follow Avoqado design system
  {
    files: ['**/playtelecom/**'],
    plugins: {
      'local': localPlugin,
    },
    rules: {
      // Disable theme violation checks
      'no-restricted-syntax': 'off',
      // Disable translation key validation
      'local/no-missing-translation-keys': 'off',
    },
  },
  // Override: Organization pages navigate TO venues (cross-context navigation)
  // These files are in organization context and navigate to venue context, so they can't use useCurrentVenue()
  {
    files: ['**/organizations/**'],
    plugins: {
      'local': localPlugin,
    },
    rules: {
      // Allow hardcoded /venues/ paths when navigating FROM organization TO venue
      'local/no-hardcoded-venue-paths': 'off',
    },
  },
)
