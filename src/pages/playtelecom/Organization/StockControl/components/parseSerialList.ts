/** One ICCID per line, comma, semicolon or tab — repeated ones count once. */
export function parseSerialList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;\t]+/)
        .map(s => s.trim())
        .filter(Boolean),
    ),
  ]
}
