/**
 * Conversión de tasas para el wizard de AngelPay.
 *
 * La BD y el estado del wizard guardan tasas como **decimales** (0.015 = 1.5%),
 * pero el usuario escribe el porcentaje literal (1.5). Estos helpers mirror el
 * patrón `* 100` / `/ 100` que ya usan `ProviderCostStructureDialog` y
 * `CostStructureStep` en el área Superadmin.
 *
 * Pure functions — sin I/O.
 */

/** decimal 0.015 → percent 1.5 (redondea a 4 decimales). */
export const decimalToPercent = (decimal: number): number => Math.round(decimal * 1e6) / 1e4

/** percent 1.5 → decimal 0.015 (redondea a 6 decimales). */
export const percentToDecimal = (percent: number): number => Math.round(percent * 1e4) / 1e6
