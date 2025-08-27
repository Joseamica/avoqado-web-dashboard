#!/usr/bin/env node
/*
  Lightweight i18n hardcoded text checker for TSX files.
  Usage:
    node scripts/check-i18n.js [paths...]
  If no paths are passed, defaults to scanning Superadmin pages.
*/

import fs from 'fs'
import path from 'path'

const DEFAULT_PATHS = [
  'src/pages/Superadmin',
]

const ROOT = process.cwd()
const args = process.argv.slice(2)
const targets = args.length ? args : DEFAULT_PATHS

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

    // 1) JSX text nodes between > and < (not starting with {)
    const textNodeRegex = />\s*([^<{][^<{}]*)\s*</g
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
  const files = targets
    .map(p => path.join(ROOT, p))
    .flatMap(p => (fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? listFiles(p) : [p]) : []))
    .filter(isTSX)

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
