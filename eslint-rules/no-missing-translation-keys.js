/**
 * ESLint rule to detect potential missing translation keys
 *
 * Detects strings like 'namespace.key' inside t() calls and validates
 * they exist in the translation JSON files.
 *
 * Distinguishes from:
 * - Money amounts: '100.50', '$1,234.56' (contain digits)
 * - URLs: 'api.example.com' (contain known TLDs)
 * - File paths: 'path/to/file.ts'
 */

import fs from 'fs'
import path from 'path'

// Cache for loaded translations
const translationCache = new Map()

/**
 * Load translation JSON file
 */
function loadTranslations(localesPath, namespace, lang = 'en') {
  const cacheKey = `${lang}:${namespace}`
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)
  }

  try {
    const filePath = path.join(localesPath, lang, `${namespace}.json`)
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      translationCache.set(cacheKey, content)
      return content
    }
  } catch {
    // Ignore errors, return null
  }

  translationCache.set(cacheKey, null)
  return null
}

/**
 * Check if a nested key exists in an object
 */
function keyExists(obj, keyPath) {
  if (!obj) return false
  const parts = keyPath.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false
    }
    if (!(part in current)) {
      return false
    }
    current = current[part]
  }
  return true
}

/**
 * Check if a string looks like a translation key (not a number/money/URL)
 */
function looksLikeTranslationKey(str) {
  // Must have at least one dot
  if (!str.includes('.')) {
    return false
  }

  // Exclude if contains digits (likely money: '100.50', '1,234.56')
  if (/\d/.test(str)) {
    return false
  }

  // Exclude URLs and domains (contains common TLDs)
  const tldPattern = /\.(com|org|net|io|dev|app|co|mx|es|fr|de|uk|edu|gov|ai|cloud)$/i
  if (tldPattern.test(str)) {
    return false
  }

  // Exclude file paths (contains slashes or file extensions)
  if (str.includes('/') || /\.(js|ts|tsx|jsx|json|md|css|html|png|jpg|svg)$/i.test(str)) {
    return false
  }

  // Exclude if starts with http/https/www
  if (/^(https?:|www\.)/i.test(str)) {
    return false
  }

  // Exclude email-like patterns
  if (str.includes('@')) {
    return false
  }

  // Exclude version strings like 'v1.0.0' or '1.0.0'
  if (/^v?\d/.test(str) || /^\d+\.\d+/.test(str)) {
    return false
  }

  // Exclude CSS class-like patterns (bg-something.modifier)
  if (/^(bg-|text-|border-|shadow-|ring-)/.test(str)) {
    return false
  }

  // Must match translation key pattern: lowercase.lowercase or with underscores
  // Examples: 'common.error', 'team.invite.title', 'validation.email_required'
  const translationKeyPattern = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/
  return translationKeyPattern.test(str)
}

/**
 * Extract namespace from useTranslation call in the same scope
 */
function findNamespaceInScope(node) {
  // Look for useTranslation('namespace') in the function/component scope
  let current = node
  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      // Found function scope, search for useTranslation
      break
    }
    current = current.parent
  }
  // Default to null - can't determine namespace
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect potential untranslated keys in t() function calls',
      category: 'Possible Errors',
      recommended: true,
    },
    messages: {
      missingTranslation:
        'Translation key "{{key}}" may not exist. Verify it exists in locales/{{lang}}/{{namespace}}.json',
      suspiciousKey:
        'Suspicious translation key pattern: "{{key}}". This looks like a translation key but may be a typo.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          localesPath: {
            type: 'string',
            description: 'Path to locales directory (relative to project root)',
          },
          validateAgainstJson: {
            type: 'boolean',
            default: false,
            description: 'Whether to validate keys against JSON files',
          },
          defaultNamespace: {
            type: 'string',
            default: 'common',
            description: 'Default namespace when none is specified',
          },
          ignoredPrefixes: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Prefixes to ignore (e.g., ["zod.", "error."])',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {}
    const validateAgainstJson = options.validateAgainstJson || false
    const defaultNamespace = options.defaultNamespace || 'common'
    const ignoredPrefixes = options.ignoredPrefixes || []

    // Get locales path relative to the eslint config
    const filename = context.getFilename()
    const projectRoot = filename.includes('/src/')
      ? filename.substring(0, filename.indexOf('/src/'))
      : process.cwd()
    const localesPath = options.localesPath
      ? path.join(projectRoot, options.localesPath)
      : path.join(projectRoot, 'src/locales')

    /**
     * Check if the key should be ignored based on prefixes
     */
    function shouldIgnore(str) {
      return ignoredPrefixes.some((prefix) => str.startsWith(prefix))
    }

    /**
     * Detect the namespace from the call context
     * e.g., for useTranslation('team'), t('header.title') -> namespace is 'team'
     */
    function detectNamespace(node) {
      // Walk up to find the component/function and look for useTranslation calls
      // For now, return default namespace
      // A more sophisticated implementation would track useTranslation calls
      return defaultNamespace
    }

    /**
     * Check if we're inside a t() or useTranslation related call
     */
    function isInsideTranslationCall(node) {
      let parent = node.parent

      while (parent) {
        if (parent.type === 'CallExpression') {
          const callee = parent.callee

          // t('key') or tCommon('key')
          if (callee.type === 'Identifier' && (callee.name === 't' || callee.name === 'tCommon')) {
            // Check if this is the first argument
            if (parent.arguments[0] === node) {
              return { isTranslationCall: true, functionName: callee.name }
            }
          }

          // i18n.t('key')
          if (
            callee.type === 'MemberExpression' &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 't'
          ) {
            if (parent.arguments[0] === node) {
              return { isTranslationCall: true, functionName: 't' }
            }
          }
        }

        // Don't traverse too far up
        if (parent.type === 'Program' || parent.type === 'FunctionDeclaration') {
          break
        }

        parent = parent.parent
      }

      return { isTranslationCall: false }
    }

    /**
     * Validate a potential translation key
     */
    function validateKey(node, str) {
      // Skip empty strings or very short strings
      if (str.length < 3) {
        return
      }

      // Check if inside a t() call
      const { isTranslationCall, functionName } = isInsideTranslationCall(node)
      if (!isTranslationCall) {
        return
      }

      // Check if it looks like a translation key
      if (!looksLikeTranslationKey(str)) {
        return
      }

      // Check if should be ignored
      if (shouldIgnore(str)) {
        return
      }

      // If validation against JSON is enabled, check if key exists
      if (validateAgainstJson) {
        // Determine namespace - for tCommon, use 'common'
        const namespace = functionName === 'tCommon' ? 'common' : detectNamespace(node)

        const translations = loadTranslations(localesPath, namespace, 'en')
        if (translations && !keyExists(translations, str)) {
          context.report({
            node,
            messageId: 'missingTranslation',
            data: { key: str, lang: 'en', namespace },
          })
        }
      } else {
        // Without JSON validation, only warn about clear mistakes
        // t('common.x') should probably be tCommon('x')
        const parts = str.split('.')
        if (parts.length >= 2 && functionName === 't') {
          const firstPart = parts[0].toLowerCase()

          // Only flag if using t() with 'common.' prefix - should use tCommon() instead
          if (firstPart === 'common') {
            context.report({
              node,
              messageId: 'suspiciousKey',
              data: { key: str },
            })
          }
        }
      }
    }

    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value === 'string') {
          validateKey(node, node.value)
        }
      },

      // Also check template literals without expressions
      TemplateLiteral(node) {
        if (node.expressions.length === 0 && node.quasis[0]) {
          const str = node.quasis[0].value.raw
          validateKey(node, str)
        }
      },
    }
  },
}
