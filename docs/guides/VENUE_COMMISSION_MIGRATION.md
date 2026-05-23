# Migración: `VenueCommission` (legacy) → `MerchantRevenueShare` (nuevo)

> **Status**: PENDING — esperando decisión de Jose. **Nada se ha ejecutado en producción.**

## 🎯 Contexto rápido

Hay 2 modelos de "reparto" coexistiendo en la base de datos. Uno es legacy y no opera. El otro es nuevo y sí.

| | `VenueCommission` (legacy) | `MerchantRevenueShare` (nuevo) |
|---|---|---|
| **Granularidad** | 1 por venue (con un único `rate`) | 1 por merchant (con 4 tasas + 2 shares) |
| **Calculado** | Por job batch (mensual) — **APAGADO en prod** | En reporte (vivo) |
| **UI** | Retirada (oculta con `hidden` en `Aggregators.tsx` Section 3) | Activa en `/superadmin/aggregators` sección "Reporte de revenue-share" |
| **Backend** | Código intacto, job apagado en `server.ts:350` | Operacional, sin uso real todavía |

## 📊 Datos en producción al 2026-05-23

Tabla `VenueCommission` tiene **2 rows activas**:

| Venue | Aggregator | Rate | referredBy | Active |
|---|---|---|---|---|
| Alberto Dominguez | Externo (Moneygiver) | 7.00% | EXTERNAL | ✅ |
| Doña Simona | Externo (Moneygiver) | 4.62% | EXTERNAL | ✅ |

Sus merchants en `VenuePaymentConfig.primaryAccountId`:

| Venue | Merchant (display) | Provider | TXs últimos 30d | Volumen 30d |
|---|---|---|---|---|
| Alberto Dominguez | Externo - 2840744149 - Alberto | BLUMON | 48 | $227,450.00 |
| Doña Simona | Externo - 2840744168 - Simona | BLUMON | 252 | $163,028.92 |

`Aggregator.baseFees` del catálogo "Externo" (lo que el agregador cobra a Avoqado):

```json
{ "DEBIT": 0.025, "CREDIT": 0.025, "AMEX": 0.035, "INTERNATIONAL": 0.038, "OTHER": 0.025 }
```

Tarifas reales promedio (de TransactionCost de últimos 90 días):

| Card | provider% | venue% | margen |
|---|---|---|---|
| DEBIT | 1.68 | 3.19 | 1.51 |
| CREDIT | 1.99 | 2.93 | 0.94 |
| AMEX | 3.34 | 3.59 | 0.24 |
| INTERNATIONAL | 3.80 | 5.04 | 1.24 |

Eso confirma que el agregador "Externo" SÍ está en el chain de pago real — la tarifa que paga el venue es mayor a la del provider, y la diferencia se distribuye entre Externo y Avoqado.

## 🛠️ Plan de migración (cuando estés listo)

### Pre-requisitos

1. Decidir los % de split por venue (puede ser distinto entre Alberto y Doña Simona). Por ejemplo:
   - 50/50 si Avoqado y Moneygiver se reparten el margen equitativo
   - 70/30 si Avoqado se queda más (como decía el legacy EXTERNAL)
   - 30/70 si Moneygiver se queda más
   - Cada venue puede tener su propio %

### Opción A — Vía API (recomendado, más auditable)

Para cada uno de los 2 merchants, hacer un POST autenticado como SUPERADMIN al endpoint:

```http
POST https://api.avoqado.io/api/v1/dashboard/superadmin/merchant-revenue-shares
Content-Type: application/json
Cookie: <session cookie>

{
  "merchantAccountId": "<merchant_id>",
  "aggregatorPrice": {
    "DEBIT": 0.025,
    "CREDIT": 0.025,
    "AMEX": 0.035,
    "INTERNATIONAL": 0.038
  },
  "aggregatorPriceIncludesTax": true,
  "avoqadoShareOfProviderMargin": 0.5,
  "avoqadoShareOfAggregatorMargin": 0.5,
  "taxRate": 0.16,
  "notes": "Migrado desde VenueCommission legacy 2026-05-XX"
}
```

Los `merchantAccountId` de los 2 merchants los obtienes con:

```sql
SELECT v.name AS venue, ma.id AS merchant_id, ma."displayName"
FROM "Venue" v
JOIN "VenuePaymentConfig" vpc ON vpc."venueId" = v.id
JOIN "MerchantAccount" ma ON ma.id = vpc."primaryAccountId"
WHERE v.id IN ('cmmdrmeh9004ko51r9r6y45m7', 'cmn3acoxt000mn227k1vdgj95');
```

Luego desactivar las VenueCommission viejas:

```sql
UPDATE "VenueCommission"
SET active = false, "updatedAt" = NOW()
WHERE "venueId" IN ('cmmdrmeh9004ko51r9r6y45m7', 'cmn3acoxt000mn227k1vdgj95')
  AND active = true;
```

### Opción B — Más fácil: vía UI

Después de hacer deploy con los cambios de revenue-share:

1. Login como SUPERADMIN en `dashboardv2.avoqado.io/superadmin/aggregators`
2. Bajar al "Reporte de revenue-share"
3. Click en la fila de "Cuenta Blumon A" o el merchant de Doña Simona / Alberto
4. Llenar el form con los valores de arriba:
   - ✅ Hay un agregador intermediario
   - Tarifas: 2.5 / 2.5 / 3.5 / 3.8
   - ✅ Las tasas ya incluyen IVA
   - % provider→agg: el % que decidas (50, 70, etc.)
   - % agg→venue: lo mismo
   - IVA: 16
5. **Crear reparto** — el preview en vivo te muestra cómo queda con $100 de venta
6. Repetir para el segundo venue

Y desactivar las VenueCommission rows (manualmente via SQL como arriba — el botón en la UI ya no existe porque la sección fue retirada).

## ⚠️ Verificación post-migración

Después de aplicar:

```sql
-- Esperado: 2 rows nuevas en MerchantRevenueShare
SELECT m.id, m."merchantAccountId", ma."displayName",
       m."avoqadoShareOfProviderMargin", m."avoqadoShareOfAggregatorMargin", m.notes
FROM "MerchantRevenueShare" m
JOIN "MerchantAccount" ma ON ma.id = m."merchantAccountId";

-- Esperado: 2 VenueCommission rows con active=false (no se eliminan, queda histórico)
SELECT v.name, vc.rate, vc.active
FROM "VenueCommission" vc
JOIN "Venue" v ON v.id = vc."venueId";
```

Después abrir el **Reporte de revenue-share** en `/superadmin/aggregators` y verificar:
- Badge cambió de `sin config` a `vía agregador` para los 2 merchants
- Los $ del reparto cuadran con la expectativa (suma Avoqado + Externo + Provider = volumen total pre-IVA)

## 🛟 Rollback (si algo no cuadra)

```sql
-- Re-activar VenueCommission
UPDATE "VenueCommission"
SET active = true, "updatedAt" = NOW()
WHERE "venueId" IN ('cmmdrmeh9004ko51r9r6y45m7', 'cmn3acoxt000mn227k1vdgj95');

-- Eliminar los MerchantRevenueShare migrados
DELETE FROM "MerchantRevenueShare"
WHERE notes LIKE 'Migrado desde VenueCommission legacy%';
```

No hay daño porque ningún flujo de pago en vivo lee de ninguno de los dos modelos — solo los reportes y el job (que está apagado).

## 🗂️ Cleanup posterior (cuando ya esté todo verificado en prod)

Tras meses de operar bien con MerchantRevenueShare:

1. Eliminar `VenueCommission` rows con `active=false` (las migradas)
2. Eliminar tabla `VenueCommission` del schema (migración Prisma `drop table`)
3. Eliminar `venue-commission-settlement.job.ts` y los servicios/controllers asociados
4. Eliminar el wrapper `<div className="space-y-4 hidden">...</div>` de `Aggregators.tsx`
5. Eliminar el `CommissionDialog` component y todas sus mutations en el mismo archivo

## 📞 Decisión pendiente

Antes de ejecutar, Jose tiene que confirmar:

1. **¿Los % exactos para cada venue?** Default propuesto: 50/50 ambos. Puede ser distinto por venue.
2. **¿Existe relación de referido fuera del agregador?** Si Avoqado le paga a un humano externo por traernos a Doña Simona, eso NO se modela con MerchantRevenueShare — necesita otro sistema (o se sigue llevando offline en Excel).
3. **¿OK con que las VenueCommission queden como `active=false` y NO se eliminen?** Default propuesto: sí, para preservar historial.

Cuando confirme, ejecutar la sección "Plan de migración" arriba.
