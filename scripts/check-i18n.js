#!/usr/bin/env node
/*
  Lightweight i18n hardcoded text checker for TSX files.
  Usage:
    node scripts/check-i18n.js [paths...]
  Behavior:
    - If paths are provided, scans those.
    - In CI (GITHUB_ACTIONS=true) with no args, scans only changed .tsx files
      relative to the base branch (PR base or current branch on origin).
    - Locally with no args, scans the entire `src/` tree.
*/

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const DEFAULT_PATHS = ['src']
const isCI = process.env.GITHUB_ACTIONS === 'true'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const targets = args.length ? args : undefined

/** Recursively list files under a directory */
function listFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

function isTSX(file) {
  return file.endsWith('.tsx')
}

function isDeprecated(file) {
  return file.includes('DEPRECATED')
}

function looksLikeText(s) {
  const t = s.trim()
  if (!t) return false
  // Ignore punctuation/whitespace only
  if (/^[\p{P}\p{S}\s\d]+$/u.test(t)) return false
  // Contains at least one letter
  if (/\p{L}/u.test(t)) return true
  return false
}

function scanFile(file) {
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split(/\r?\n/)
  const issues = []

  lines.forEach((line, idx) => {
    const lineNo = idx + 1

    // Skip lines that already call t('...')
    if (line.includes("t('") || line.includes('t("')) return

    // Skip SVG title tags (metadata from design tools)
    if (line.includes('<title>') && line.includes('</title>')) return

    // 1) JSX text nodes between > and < (not starting with {)
    // Match JSX text nodes where the next tag is a proper closing tag
    const textNodeRegex = />\s*([^<{][^<{}]*)\s*<\//g
    let m
    while ((m = textNodeRegex.exec(line)) !== null) {
      const text = m[1]
      if (looksLikeText(text)) {
        issues.push({
          type: 'jsx-text',
          line: lineNo,
          column: m.index + 1,
          message: `Hardcoded JSX text node: "${text.trim().slice(0, 60)}"`,
        })
      }
    }

    // 2) Problematic attributes with quoted strings
    const attrNames = ['placeholder', 'title', 'aria-label', 'alt', 'label']
    for (const attr of attrNames) {
      const attrRegex = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`)
      const am = attrRegex.exec(line)
      if (am && looksLikeText(am[1])) {
        issues.push({
          type: 'attr-text',
          line: lineNo,
          column: am.index + 1,
          message: `Hardcoded attribute ${attr}: "${am[1].trim().slice(0, 60)}"`,
        })
      }
    }
  })
  return issues
}

function main() {
  let files = []

  if (targets && targets.length) {
    files = targets
      .map(p => path.join(ROOT, p))
      .flatMap(p => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? listFiles(p) : [p]) : []))
      .filter(isTSX)
      .filter(f => !isDeprecated(f))
  } else if (isCI) {
    // In CI: scan only changed TSX files
    try {
      const refName = process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || ''
      const baseBranch = process.env.GITHUB_BASE_REF || refName || 'develop'
      // Ensure we have the base branch ref
      execSync(`git fetch --no-tags --depth=2 origin ${baseBranch}`, { stdio: 'ignore' })
      const diffOutput = execSync(`git diff --name-only --diff-filter=ACMRT origin/${baseBranch}...HEAD`, {
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim()
      const changed = diffOutput ? diffOutput.split(/\r?\n/) : []
      files = changed
        .filter(f => f && isTSX(f))
        .map(f => path.join(ROOT, f))
        .filter(f => !isDeprecated(f))

      if (files.length === 0) {
        console.log('i18n check skipped: no changed .tsx files detected.')
        process.exit(0)
      }
    } catch (e) {
      console.warn('i18n check warning: failed to detect changed files, falling back to full scan of src/.')
      files = DEFAULT_PATHS
        .map(p => path.join(ROOT, p))
        .flatMap(p => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? listFiles(p) : [p]) : []))
        .filter(isTSX)
        .filter(f => !isDeprecated(f))
    }
  } else {
    // Local default: full repo scan under src/
    files = DEFAULT_PATHS
      .map(p => path.join(ROOT, p))
      .flatMap(p => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? listFiles(p) : [p]) : []))
      .filter(isTSX)
      .filter(f => !isDeprecated(f))
  }

  const allIssues = []
  for (const f of files) {
    const issues = scanFile(f)
    if (issues.length) {
      for (const issue of issues) {
        allIssues.push({ file: f, ...issue })
      }
    }
  }

  if (allIssues.length) {
    console.error('i18n check failed. Hardcoded text found:')
    for (const i of allIssues) {
      console.error(`${path.relative(ROOT, i.file)}:${i.line}:${i.column} - ${i.message}`)
    }
    process.exit(1)
  } else {
    console.log('i18n check passed. No hardcoded text detected in targets.')
  }
}

main()
