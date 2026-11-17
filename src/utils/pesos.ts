/** «499.00» → «$499»; con centavos reales se conservan («$499.50»). Sólo da formato: no calcula dinero. */
export const fmtPesos = (value: string) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
}
