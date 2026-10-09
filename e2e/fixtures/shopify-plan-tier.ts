/**
 * `/plan-tier` para el E2E del conector Shopify. La definición vive en `src/` (la pasa por el parser real
 * `parseVenuePlanTierInfo` la prueba unitaria `ShopifyIntegration.test.tsx`): desde `src/` no se puede importar `e2e/` sin romper
 * `tsc -b` (TS6307, `tsconfig.app.json` es composite con `include: ["src"]`). Misma respuesta en los dos lados.
 */
export { planTierShopify } from '../../src/pages/Settings/components/shopify/__tests__/planTierShopify'
