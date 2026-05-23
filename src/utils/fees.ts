/**
 * Conversion helpers between decimal-stored rates (DB convention, e.g. 0.015)
 * and percent-displayed rates (UI convention, e.g. 1.5).
 *
 * The `.toFixed(6)` round-trip prevents JS float drift like 0.035 * 100 =
 * 3.5000000000000004 from leaking into the UI.
 */

export const decimalToPercent = (d: number): number => parseFloat((d * 100).toFixed(6))

export const percentToDecimal = (p: number): number => parseFloat((p / 100).toFixed(6))
