#!/usr/bin/env node

/**
 * check-endpoints.js
 *
 * Extracts API endpoints from frontend service files and backend route files,
 * normalizes them, compares, and reports mismatches.
 *
 * Usage:
 *   node scripts/check-endpoints.js            # Normal mode
 *   node scripts/check-endpoints.js --verbose   # Show all matches
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VERBOSE = process.argv.includes('--verbose')

const FRONTEND_SERVICES_DIR = path.resolve(__dirname, '../src/services')
const BACKEND_DIR = path.resolve(__dirname, '../../avoqado-server/src')
const BACKEND_ROUTES_DIR = path.join(BACKEND_DIR, 'routes')
const BACKEND_APP_FILE = path.join(BACKEND_DIR, 'app.ts')

// ─────────────────────────────────────────────
// 1. Frontend endpoint extraction
// ─────────────────────────────────────────────

function extractFrontendEndpoints() {
  const endpoints = []
  const serviceFiles = findFiles(FRONTEND_SERVICES_DIR, /\.ts$/)

  for (const filePath of serviceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const relativePath = path.relative(FRONTEND_SERVICES_DIR, filePath)

    let inBlockComment = false
    let currentFunctionName = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Track block comments
      if (line.includes('/*')) inBlockComment = true
      if (line.includes('*/')) {
        inBlockComment = false
        continue
      }
      if (inBlockComment) continue

      // Skip single-line comments
      const trimmed = line.trim()
      if (trimmed.startsWith('//')) continue

      // Track current function/method name
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
        || line.match(/(?:export\s+)?const\s+(\w+)\s*=\s*async/)
        || line.match(/^\s+(?:async\s+)?(\w+)\s*\(/)
        || line.match(/(\w+)\s*:\s*(?:async\s*)?\(/)
      if (fnMatch) currentFunctionName = fnMatch[1]

      // Match api.get(...), api.post(...), etc.
      const regex = /api\.(get|post|put|patch|delete)\s*[<(]/gi
      let match
      while ((match = regex.exec(line)) !== null) {
        const method = match[1].toUpperCase()
        // Extract the URL from the rest of the line (and possibly next lines)
        const urlPath = extractUrl(lines, i, match.index + match[0].length)
        if (urlPath && urlPath.startsWith('/api/')) {
          endpoints.push({
            method,
            path: normalizeTemplateLiterals(urlPath),
            file: relativePath,
            line: i + 1,
            functionName: currentFunctionName,
          })
        }
      }
    }
  }

  return endpoints
}

function extractUrl(lines, lineIndex, startCol) {
  // Gather enough text from current + next lines
  let text = lines[lineIndex].slice(startCol)
  for (let j = 1; j <= 3 && lineIndex + j < lines.length; j++) {
    text += ' ' + lines[lineIndex + j]
  }

  // Try backtick template literal — handle nested backticks by counting depth
  const btStart = text.indexOf('`')
  if (btStart !== -1) {
    let depth = 0
    let end = -1
    for (let i = btStart + 1; i < text.length; i++) {
      if (text[i] === '$' && text[i + 1] === '{') {
        depth++
        i++ // skip {
      } else if (text[i] === '}' && depth > 0) {
        depth--
      } else if (text[i] === '`' && depth === 0) {
        end = i
        break
      }
    }
    if (end !== -1) {
      return cleanUrl(text.substring(btStart + 1, end))
    }
  }

  // Try single or double quoted string
  const sqMatch = text.match(/'([^']+)'/)
  if (sqMatch) return cleanUrl(sqMatch[1])

  const dqMatch = text.match(/"([^"]+)"/)
  if (dqMatch) return cleanUrl(dqMatch[1])

  return null
}

function cleanUrl(url) {
  // Remove query params (literal ? or ${params} appended after path)
  const qIdx = url.indexOf('?')
  if (qIdx !== -1) url = url.substring(0, qIdx)
  // Remove trailing non-path interpolation (e.g. `${queryString}` appended after ?)
  // But keep path-segment interpolations like `/${couponId}`
  return url.replace(/\/+$/, '') || url
}

function normalizeTemplateLiterals(urlPath) {
  // Truncate at query string indicators
  urlPath = urlPath.replace(/\?.*$/, '')

  // Process ${...} expressions one by one
  let result = ''
  let i = 0
  while (i < urlPath.length) {
    if (urlPath[i] === '$' && urlPath[i + 1] === '{') {
      // Find the matching closing brace (handle nested braces)
      let depth = 1
      let j = i + 2
      while (j < urlPath.length && depth > 0) {
        if (urlPath[j] === '{') depth++
        else if (urlPath[j] === '}') depth--
        j++
      }
      const expr = urlPath.substring(i + 2, j - 1)

      // Simple variable or property access (path parameter) → :varName
      // Function calls, ternary, etc. → non-path expression, discard
      const simpleVar = expr.match(/^(?:this\.)?([a-zA-Z_]\w*)$/)
      if (simpleVar) {
        const varName = simpleVar[1]
        // Skip query-string variables (not path segments)
        if (/^(queryString|query|params|searchParams|filters?|options)$/i.test(varName)) {
          // discard — this is a query string, not a path segment
        } else {
          result += ':' + varName
        }
      }
      // else: discard non-path expressions

      i = j
    } else {
      result += urlPath[i]
      i++
    }
  }

  // Clean trailing slashes and backtick remnants
  result = result.replace(/[`'"]/g, '').replace(/\/+$/, '')
  return result || urlPath
}

// ─────────────────────────────────────────────
// 2. Backend route extraction
// ─────────────────────────────────────────────

function extractBackendRoutes() {
  if (!fs.existsSync(BACKEND_ROUTES_DIR)) {
    return null // backend not found
  }

  const routes = []

  // Start from app.ts to find the API prefix
  let apiPrefix = '/api/v1'
  if (fs.existsSync(BACKEND_APP_FILE)) {
    const appContent = fs.readFileSync(BACKEND_APP_FILE, 'utf-8')
    const prefixMatch = appContent.match(/API_PREFIX\s*=\s*.*?['"`]([^'"`]+)['"`]/)
    if (prefixMatch) apiPrefix = prefixMatch[1]

    // Extract routes from app.ts (both app.use mounts and direct app.get/post)
    processRouteFile(BACKEND_APP_FILE, '', routes, 0)
  }

  // Parse routes/index.ts
  const indexFile = path.join(BACKEND_ROUTES_DIR, 'index.ts')
  if (fs.existsSync(indexFile)) {
    processRouteFile(indexFile, apiPrefix, routes, 0)
  }

  return routes
}

function processRouteFile(filePath, prefix, routes, depth) {
  if (depth > 5 || !fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf-8')
  const dir = path.dirname(filePath)
  const relativePath = path.relative(BACKEND_DIR, filePath)

  // Build import map: varName → resolved file path
  const importMap = buildImportMap(content, dir)

  // Strip comments but preserve line structure (replace with spaces to keep offsets)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))  // block comments → spaces
    .replace(/\/\/.*$/gm, m => ' '.repeat(m.length))               // line comments → spaces

  function lineAt(offset) {
    let line = 1
    for (let i = 0; i < offset && i < content.length; i++) {
      if (content[i] === '\n') line++
    }
    return line
  }

  // Match router.use('/path', ..., handler) — mount sub-routers
  // Use paren-depth tracking to handle nested function calls like cors(), express.json({...})
  const useStartRegex = /(?:router|app)\.use\s*\(\s*['"`]([^'"`]+)['"`]/g
  let useMatch
  while ((useMatch = useStartRegex.exec(stripped)) !== null) {
    const mountPath = useMatch[1]
    const fullPrefix = joinPaths(prefix, mountPath)

    // Find the matching closing paren by tracking depth
    let parenDepth = 1
    let j = useMatch.index + useMatch[0].length
    const argsStart = j
    while (j < stripped.length && parenDepth > 0) {
      if (stripped[j] === '(') parenDepth++
      else if (stripped[j] === ')') parenDepth--
      j++
    }
    const argsStr = stripped.substring(argsStart, j - 1)

    // Last identifier in args is the router handler
    const identifiers = argsStr.match(/\b[a-zA-Z_]\w*\b/g)
    if (identifiers) {
      const handlerName = identifiers[identifiers.length - 1]
      if (importMap[handlerName]) {
        processRouteFile(importMap[handlerName], fullPrefix, routes, depth + 1)
      }
    }
  }

  // Match router.get/post/put/patch/delete('path', ...) — including multiline
  const routeRegex = /(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
  let routeMatch
  while ((routeMatch = routeRegex.exec(stripped)) !== null) {
    const method = routeMatch[1].toUpperCase()
    const routePath = routeMatch[2]
    routes.push({
      method,
      path: joinPaths(prefix, routePath),
      file: relativePath,
      line: lineAt(routeMatch.index),
    })
  }
}

function extractRoutesFromFile(filePath, prefix, routes) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(BACKEND_DIR, filePath)
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) continue

    const routeMatch = line.match(/app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/)
    if (routeMatch) {
      routes.push({
        method: routeMatch[1].toUpperCase(),
        path: joinPaths(prefix, routeMatch[2]),
        file: relativePath,
        line: i + 1,
      })
    }
  }
}

function buildImportMap(content, dir) {
  const map = {}
  const importRegex = /import\s+(\w+)\s+from\s+['"`](\.[^'"`]+)['"`]/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const varName = match[1]
    const importPath = match[2]
    const resolved = resolveImport(dir, importPath)
    if (resolved) map[varName] = resolved
  }
  return map
}

function resolveImport(dir, importPath) {
  const base = path.resolve(dir, importPath)
  // Try exact, .ts, /index.ts
  const candidates = [base, base + '.ts', path.join(base, 'index.ts')]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

// ─────────────────────────────────────────────
// 3. Matching & comparison
// ─────────────────────────────────────────────

function normalizeForComparison(pathStr) {
  // Replace all :paramName with :_ for comparison
  return pathStr.replace(/:[^/]+/g, ':_')
}

function compareEndpoints(frontendEndpoints, backendRoutes) {
  const backendSet = new Map()
  for (const r of backendRoutes) {
    const key = r.method + ' ' + normalizeForComparison(r.path)
    if (!backendSet.has(key)) backendSet.set(key, r)
  }

  const frontendSet = new Map()
  for (const e of frontendEndpoints) {
    const key = e.method + ' ' + normalizeForComparison(e.path)
    if (!frontendSet.has(key)) frontendSet.set(key, e)
  }

  const matched = []
  const mismatches = []
  const backendOnly = []

  for (const e of frontendEndpoints) {
    const key = e.method + ' ' + normalizeForComparison(e.path)
    if (backendSet.has(key)) {
      matched.push(e)
    } else {
      const suggestions = findSuggestion(e, backendRoutes)
      mismatches.push({ ...e, suggestions })
    }
  }

  for (const r of backendRoutes) {
    const key = r.method + ' ' + normalizeForComparison(r.path)
    if (!frontendSet.has(key)) {
      backendOnly.push(r)
    }
  }

  // Deduplicate mismatches by normalized key
  const seenMismatches = new Set()
  const uniqueMismatches = mismatches.filter(m => {
    const key = m.method + ' ' + normalizeForComparison(m.path)
    if (seenMismatches.has(key)) return false
    seenMismatches.add(key)
    return true
  })

  // Deduplicate matched
  const seenMatched = new Set()
  const uniqueMatched = matched.filter(m => {
    const key = m.method + ' ' + normalizeForComparison(m.path)
    if (seenMatched.has(key)) return false
    seenMatched.add(key)
    return true
  })

  return { matched: uniqueMatched, mismatches: uniqueMismatches, backendOnly }
}

// ─────────────────────────────────────────────
// 4. "Did you mean?" fuzzy match
// ─────────────────────────────────────────────

function findSuggestion(endpoint, backendRoutes) {
  const normPath = normalizeForComparison(endpoint.path)
  const segments = normPath.split('/').filter(Boolean)
  let bestScore = 0
  let bestRoute = null

  let bestSameMethod = null
  let bestSameScore = 0
  let bestAnyMethod = null
  let bestAnyScore = 0

  for (const r of backendRoutes) {
    const rNorm = normalizeForComparison(r.path)
    const rSegments = rNorm.split('/').filter(Boolean)

    const maxLen = Math.max(segments.length, rSegments.length)
    if (maxLen === 0) continue

    // Score each segment: 1.0 for exact match, partial credit for similar strings
    let totalScore = 0
    for (let i = 0; i < Math.min(segments.length, rSegments.length); i++) {
      if (segments[i] === rSegments[i]) {
        totalScore += 1.0
      } else {
        totalScore += stringSimilarity(segments[i], rSegments[i])
      }
    }

    const score = totalScore / maxLen
    if (score < 0.5) continue

    if (r.method === endpoint.method && score > bestSameScore) {
      bestSameScore = score
      bestSameMethod = r
    }
    if (score > bestAnyScore) {
      bestAnyScore = score
      bestAnyMethod = r
    }
  }

  // Prefer same-method suggestion; also include cross-method if it's significantly better
  const suggestions = []
  if (bestSameMethod) suggestions.push(bestSameMethod)
  if (bestAnyMethod && bestAnyMethod !== bestSameMethod && bestAnyScore > bestSameScore + 0.05) {
    suggestions.push(bestAnyMethod)
  }
  // If no same-method found, use any-method
  if (!bestSameMethod && bestAnyMethod) suggestions.push(bestAnyMethod)

  return suggestions
}

function stringSimilarity(a, b) {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ─────────────────────────────────────────────
// 5. Dead code detection
// ─────────────────────────────────────────────

/**
 * Check if a function from a service file is used anywhere outside its own file.
 * Searches pages, hooks, components, and other services.
 */
function isDeadCode(functionName, serviceFile) {
  if (!functionName) return false

  const srcDir = path.resolve(FRONTEND_SERVICES_DIR, '..')
  const serviceFullPath = path.join(FRONTEND_SERVICES_DIR, serviceFile)
  const srcFiles = findFiles(srcDir, /\.(tsx?|jsx?)$/)

  for (const file of srcFiles) {
    // Skip the service file itself
    if (path.resolve(file) === path.resolve(serviceFullPath)) continue

    const content = fs.readFileSync(file, 'utf-8')
    // Check if the function name appears (import or usage)
    if (content.includes(functionName)) return false
  }

  return true
}

// ─────────────────────────────────────────────
// 6. Service → Page URL mapping
// ─────────────────────────────────────────────

const PAGES_DIR = path.resolve(__dirname, '../src/pages')
const ROUTES_DIR = path.resolve(__dirname, '../src/routes')

/**
 * Build a map: service filename (e.g. "coupon.service.ts") → list of page component names that import it
 */
function buildServiceToPageMap() {
  const map = {}
  const pageFiles = findFiles(PAGES_DIR, /\.(tsx?|jsx?)$/)

  for (const pageFile of pageFiles) {
    const content = fs.readFileSync(pageFile, 'utf-8')
    // Find imports from @/services/ or ../../services/
    const importRegex = /from\s+['"](?:@\/services\/|[./]*services\/)([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      let serviceKey = match[1]
      // Normalize: remove extension, get basename
      serviceKey = serviceKey.replace(/\.(ts|js)$/, '')
      const baseName = path.basename(serviceKey)
      const pageName = path.basename(pageFile, path.extname(pageFile))
      const pageDir = path.basename(path.dirname(pageFile))

      if (!map[baseName]) map[baseName] = []
      map[baseName].push({ pageName, pageDir, pageFile })
    }
  }
  return map
}

/**
 * Try to find the frontend URL for a service file by:
 * 1. Finding which page components import this service
 * 2. Looking up their route path in router.tsx
 */
function findPageUrl(serviceFile, serviceToPages) {
  const baseName = path.basename(serviceFile, '.ts').replace('.service', '')

  // Check for direct match or partial match
  const pages = serviceToPages[baseName] || serviceToPages[baseName + '.service'] || null
  if (!pages || pages.length === 0) return null

  // Try to find the route for the first page component
  // Read all route files
  const routeFiles = findFiles(ROUTES_DIR, /\.(tsx?|jsx?)$/)
  const allRouterContent = routeFiles.map(f => ({
    content: fs.readFileSync(f, 'utf-8'),
    file: f,
  }))

  for (const page of pages) {
    for (const { content: routerContent, file: routeFile } of allRouterContent) {
      // Pattern: { path: 'something', element: <ComponentName /> }
      // Also handle: path: 'something', element: <ComponentName />  (multiline)
      const routeRegex = new RegExp(
        `path:\\s*['"]([^'"]+)['"][\\s\\S]{0,200}element:\\s*<${page.pageName}[\\s/>]`
      )
      const routeMatch = routeRegex.exec(routerContent)
      if (routeMatch) {
        const routePath = routeMatch[1]
        // Determine route type from context
        const before = routerContent.substring(Math.max(0, routeMatch.index - 3000), routeMatch.index)
        const isSuperadmin = before.includes("path: 'superadmin'") || page.pageDir === 'Superadmin'
        const isOrganization = routeFile.includes('organization') || before.includes("path: 'organizations'")

        if (isSuperadmin) {
          return `/superadmin/${routePath}`
        }
        if (isOrganization) {
          return `/organizations/avoqado-full/${routePath}`
        }
        return `/venues/avoqado-full/${routePath}`
      }
    }
  }

  return null
}

// ─────────────────────────────────────────────
// 6. Utility functions
// ─────────────────────────────────────────────

function findFiles(dir, pattern) {
  const results = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern))
    } else if (pattern.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

function joinPaths(...parts) {
  return ('/' + parts.join('/'))
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/'
}

function printMismatch(m, serviceToPages, isDead = false) {
  const deadLabel = isDead ? ' \x1b[2m(dead code)\x1b[0m' : ''
  const fnLabel = m.functionName ? ` \x1b[2m→ ${m.functionName}()\x1b[0m` : ''
  console.log(`    ${m.method} ${m.path}${deadLabel}`)
  console.log(`    \x1b[2m  Frontend: src/services/${m.file}:${m.line}${fnLabel}\x1b[0m`)
  if (m.suggestions && m.suggestions.length > 0) {
    for (const s of m.suggestions) {
      console.log(`    \x1b[33m  Did you mean? ${s.method} ${s.path}\x1b[0m`)
      console.log(`    \x1b[2m  Backend:  ${s.file}:${s.line}\x1b[0m`)
    }
  }
  if (!isDead) {
    const pageUrl = findPageUrl(m.file, serviceToPages)
    if (pageUrl) {
      console.log(`    \x1b[36m  Test URL: http://localhost:5173${pageUrl}\x1b[0m`)
    }
  }
  console.log()
}

// ─────────────────────────────────────────────
// 7. Main
// ─────────────────────────────────────────────

function main() {
  console.log('\n\x1b[1m\x1b[36m  API Endpoint Verification\x1b[0m\n')

  // Extract frontend endpoints
  const frontendEndpoints = extractFrontendEndpoints()
  const serviceFiles = findFiles(FRONTEND_SERVICES_DIR, /\.ts$/)

  // Extract backend routes
  const backendRoutes = extractBackendRoutes()

  if (backendRoutes === null) {
    console.log('\x1b[33m  Warning: Backend directory not found at', BACKEND_ROUTES_DIR, '\x1b[0m')
    console.log('  Skipping endpoint verification (backend not available).\n')
    process.exit(0)
  }

  console.log(`  Frontend: ${frontendEndpoints.length} endpoints (${serviceFiles.length} service files)`)
  console.log(`  Backend:  ${backendRoutes.length} routes\n`)

  const { matched, mismatches, backendOnly } = compareEndpoints(frontendEndpoints, backendRoutes)

  // Build a map of service file → frontend pages that import it
  const serviceToPages = buildServiceToPageMap()

  // Check dead code for mismatches
  console.log('  Checking for dead code...\n')
  for (const m of mismatches) {
    m.deadCode = isDeadCode(m.functionName, m.file)
  }

  const activeMismatches = mismatches.filter(m => !m.deadCode)
  const deadMismatches = mismatches.filter(m => m.deadCode)

  // Report active mismatches first
  if (activeMismatches.length > 0) {
    console.log(`\x1b[31m  ACTIVE MISMATCHES (${activeMismatches.length}):\x1b[0m\n`)
    for (const m of activeMismatches) {
      printMismatch(m, serviceToPages)
    }
  }

  // Report dead code mismatches separately
  if (deadMismatches.length > 0) {
    console.log(`\x1b[2m  DEAD CODE MISMATCHES (${deadMismatches.length}) — function not used anywhere:\x1b[0m\n`)
    for (const m of deadMismatches) {
      printMismatch(m, serviceToPages, true)
    }
  }

  // Verbose: show all matched
  if (VERBOSE && matched.length > 0) {
    console.log(`\x1b[32m  MATCHED (${matched.length}):\x1b[0m\n`)
    for (const m of matched) {
      console.log(`    ${m.method} ${m.path}`)
      console.log(`    \x1b[2m  ${m.file}:${m.line}\x1b[0m`)
    }
    console.log()
  }

  // Summary
  console.log(`  \x1b[32m${matched.length} endpoints matched\x1b[0m`)
  if (backendOnly.length > 0) {
    console.log(`  \x1b[2m${backendOnly.length} backend-only routes (informational)\x1b[0m`)
  }

  if (VERBOSE && backendOnly.length > 0) {
    console.log(`\n  \x1b[2mBackend-only routes:\x1b[0m`)
    for (const r of backendOnly) {
      console.log(`    \x1b[2m${r.method} ${r.path} (${r.file}:${r.line})\x1b[0m`)
    }
  }

  console.log()

  if (activeMismatches.length > 0) {
    console.log(`\x1b[31m  FAIL: ${activeMismatches.length} active mismatch(es), ${deadMismatches.length} dead code.\x1b[0m\n`)
    process.exit(1)
  } else if (deadMismatches.length > 0) {
    console.log(`\x1b[33m  WARN: ${deadMismatches.length} dead code mismatch(es) (no active mismatches).\x1b[0m\n`)
    process.exit(0)
  } else {
    console.log(`\x1b[32m  PASS: All frontend endpoints have matching backend routes.\x1b[0m\n`)
    process.exit(0)
  }
}

main()
