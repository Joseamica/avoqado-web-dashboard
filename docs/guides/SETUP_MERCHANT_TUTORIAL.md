# 🎯 Setup completo de un Merchant — de 0 a operativo

Guía paso a paso para configurar un merchant en producción, asumiendo que el venue ya existe.

**Audiencia**: SUPERADMIN del backoffice.
**Tiempo estimado**: 5-10 min por merchant si tienes todos los datos a la mano.
**Resultado**: un merchant que (a) puede cobrar con tarjeta vía TPV, (b) liquida al venue correctamente, (c) tiene su reparto Avoqado/agregador definido.

---

## 🧭 Mapa mental — las 4 capas de configuración

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1: PROVIDER (catálogo global)                                  │
│   - Blumon, AngelPay, Stripe, Mercado Pago                           │
│   - Ya están creados; rara vez agregas uno nuevo                     │
│   - /superadmin/payment-providers                                    │
└──────────────────────────────────────────────────────────────────────┘
                            ↓ se usa en
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 2: AGGREGATOR (catálogo global, opcional)                      │
│   - Intermediario que cobra al venue y nos paga (ej. Moneygiver)     │
│   - Catálogo solamente: nombre + IVA. Tarifas reales en layer 4.     │
│   - /superadmin/aggregators                                          │
└──────────────────────────────────────────────────────────────────────┘
                            ↓ asignado en
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 3: MERCHANT ACCOUNT (1+ por venue)                             │
│   - Las credenciales reales del provider para ese venue              │
│   - Slot PRIMARY / SECONDARY / TERTIARY                              │
│   - Costo del provider, precio al venue, settlement                  │
│   - /superadmin/merchant-accounts (botón "Agregar AngelPay")         │
└──────────────────────────────────────────────────────────────────────┘
                            ↓ con reparto definido en
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 4: REVENUE SHARE (opcional, configurable por merchant)         │
│   - Cómo se reparte el margen entre Avoqado / agregador / provider   │
│   - Default si no se configura: 100% Avoqado (legacy)                │
│   - /superadmin/aggregators (sección "Reporte de revenue-share")    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Atajo: el Wizard de AngelPay hace TODO en 1 flujo

Para un merchant nuevo, **NO necesitas tocar las páginas dedicadas**. Solo:

1. Ve a `/superadmin/merchant-accounts`
2. Click en **Agregar AngelPay**
3. Sigue los 10 pasos. Te cubre layers 2 + 3 + 4.

El wizard tiene "Configurar después" en pasos 5-9, así que solo lo crítico es obligatorio. Los pasos opcionales los puedes llenar luego desde las páginas dedicadas (Layer 1 para providers, `/superadmin/aggregators` para Layer 2 + 4).

---

## 📋 Tutorial detallado paso a paso

### Pre-requisito (solo si es el primer venue del agregador)

Si vas a usar un **agregador nuevo que no esté en el catálogo**:

1. Ve a `/superadmin/aggregators`
2. Click **+ Nuevo Agregador**
3. Llena:
   - **Nombre**: ej. `Moneygiver`
   - **Tarifa de referencia**: déjalo en `0` (no se usa para cálculos, es solo memo)
   - **IVA**: `16` (default MX, dejarlo así)
4. Click **Crear Agregador**

> 💡 Lo que viste en el dialog es **catálogo nada más**. Las tarifas reales se definen al asignar el agregador a un merchant (paso 4 abajo).

### Paso 1 — Abrir el wizard

1. Ve a `/superadmin/merchant-accounts`
2. Click en **Agregar AngelPay** (botón amarillo arriba).

El wizard tiene 10 pasos. Te van guiando con tabs arriba.

### Paso 2 — Venue

Elige el venue al que vas a agregar el merchant.

> ⚠️ Cuidado: cambiar de venue después de avanzar resetea TODO el wizard. Asegúrate del venue antes de pasar.

### Paso 3 — Cuenta AngelPay (login)

Hay 2 modos:

**Modo "Existing"** (recomendado si el venue ya tiene cuenta AngelPay registrada):
- Selecciona la cuenta del dropdown
- No te pide más datos

**Modo "New"**:
- **Email**: el email del login en AngelPay (no es Avoqado)
- **PIN**: 6 dígitos (el PIN que se mete en el TPV)
- **Environment**: `QA` para pruebas, `PROD` para producción real

### Paso 4 — Merchant

Hay 2 modos:

**Modo "Create"** (cuando es un merchant nuevo):
- **External Merchant ID**: número del merchant en AngelPay (ej. `9814275`)
- **Nombre**: nombre legal/comercial (ej. `Doña Simona Restaurant`)
- **Afiliación**: tu # de afiliación con el adquirente
- **Display Name**: nombre amigable que se ve en reportes
- **Confirmar ID**: ✅ marca esta casilla cuando hayas verificado dos veces el External Merchant ID

**Modo "Existing"** (cuando ya está dado de alta y solo quieres ligarlo a este venue):
- Selecciona del dropdown

> 💡 Si tienes un TPV físico encendido, puedes hacer **"Descubrir merchants en TPV"** para autopopular este paso.

### Paso 5 — Slot del venue

Cada venue tiene 3 slots: **PRIMARY**, **SECONDARY**, **TERTIARY**. Define el orden de ruteo de pagos.

- **Mode "Fill"**: el slot está vacío y lo llenas con este merchant. La opción normal.
- **Mode "Replace"**: el slot ya tenía otro merchant y lo reemplazas. Te obliga a llenar el step "Precio al venue".

Por default casi siempre vas con **PRIMARY + fill**.

### Paso 6 — Terminales (opcional)

Si ya creaste terminales NEXGO/PAX para este merchant, las asignas aquí.
Si no, deja **"Configurar después"** marcado y créalas luego desde `/superadmin/terminals`.

### Paso 7 — Costo del procesador (opcional)

**Lo que AngelPay/Blumon nos cobra a Avoqado** por procesar una transacción. Aquí también escoges el **Agregador** si aplica.

| Campo | Cómo llenarlo |
|---|---|
| **Agregador** | Dropdown: pick uno o "+ Crear agregador" inline |
| **Débito / Crédito / Amex / Internacional** | El % por tipo de tarjeta. Escribe el valor literal (ej. `1.5` para 1.5%) |
| **Cuota fija / transacción** | Si AngelPay nos cobra un fijo por tx (ej. $0.30 MXN) |
| **Cuota mensual** | Si AngelPay nos cobra una mensualidad fija |
| **Vigente desde** | Fecha en la que entra esta tarifa (default: hoy) |
| **Las tasas ya incluyen IVA** | ✅ si los % de arriba ya son IVA-inclusivos (default), ☐ si son "+IVA" |

> 💡 Si vas a configurar revenue-share en el paso 9, el agregador que pongas aquí queda ligado al merchant — lo verás en el reporte como ruta "vía agregador".

### Paso 8 — Precio al venue (opcional)

**Lo que Avoqado le cobra al venue** por procesar su pago. Mismos campos que el paso 7, pero del lado del venue.

> El margen entre lo que cobramos al venue y lo que nos cobra el provider = ganancia. Ese margen es lo que se reparte en el paso 9.

### Paso 9 — Liquidación (opcional)

Cuándo y cómo le pagamos al venue:

- **Días de liquidación**: 1 = T+1, 2 = T+2, etc.
- **Tipo de día**: `BUSINESS_DAYS` (hábiles) o `CALENDAR_DAYS` (naturales)
- **Hora de corte**: ej. `23:00` (cualquier tx después se va al siguiente día)
- **Zona horaria**: `America/Mexico_City` (default)

### Paso 10 — Reparto Avoqado / agregador (opcional, NUEVO)

> **Importante**: si NO configuras esto, el merchant tiene comportamiento legacy = 100% del margen va a Avoqado. Solo opta in si tienes un acuerdo de revenue-share específico con el agregador.

**Casos típicos**:

#### Caso 1: Sin agregador (directo Avoqado ↔ venue)

```
Provider cobra X% → Avoqado cobra Y% al venue → margen = Y-X
                                                  ↓
                                          50% / 50% Avoqado vs ???
```

- Deja **"Hay un agregador"** ☐ sin marcar
- **% que se queda Avoqado del margen (provider → venue)**: `50` (= 50/50). Si quieres que Avoqado se quede todo, pon `100`.
- **IVA**: `16` (default)

#### Caso 2: Con agregador intermediario (Caso típico de Moneygiver)

```
Provider cobra 2% → Avoqado cobra 4% al agregador → Agregador cobra 7% al venue
                  margen1 = 2%                      margen2 = 3%
                  ↓                                 ↓
                  Avoqado/Agg se reparten           Agg/Avoqado se reparten
```

- ✅ Marca **"Hay un agregador"**
- **Tarifas del agregador → Avoqado (%) por tipo de tarjeta**:
  - Débito: `4`
  - Crédito: `4`
  - Amex: `5`
  - Internacional: `5`
- **Las tasas del agregador ya incluyen IVA**: ✅ (default)
- **% que se queda Avoqado del margen (provider → agregador)**: `50`
- **% que se queda Avoqado del margen (agregador → venue)**: `50`
- **IVA**: `16`

### Paso 11 — Resumen + Confirmar

Revisa el panel derecho. Cada sección debe tener ✓ verde (configurado) o ⚠ pendiente (skip).

Click **"Confirmar"** abajo a la derecha. Todo se crea en una transacción atómica:
- AngelPayUserAccount
- MerchantAccount
- VenuePaymentConfig (slot del venue)
- (opcional) Terminales asignadas
- (opcional) ProviderCostStructure
- (opcional) VenuePricingStructure
- (opcional) SettlementConfiguration

Después, **fuera de la transacción**, se hace un POST de revenue-share (si lo opt-in). Si ese POST falla, el merchant ya quedó OK y puedes configurarlo después desde `/superadmin/aggregators` (siguiente sección).

---

## 🔧 Editar revenue-share después de la alta

Si saltaste el paso 10 del wizard o quieres ajustar el reparto:

1. Ve a `/superadmin/aggregators`
2. Baja a **📊 Reporte de revenue-share**
3. Encuentra el merchant en la tabla
4. **Click en la fila** → se abre el dialog de edición
5. Configura igual que en el paso 10 del wizard
6. **Guardar cambios** (o **Eliminar** para volver al legacy 100% Avoqado)

Los cambios afectan corridas futuras del reporte. No tocan transacciones ya cobradas ni la liquidación legacy.

---

## 🆘 Troubleshooting

### "No me deja avanzar en el wizard"
El botón **Siguiente** está deshabilitado si el paso actual no es válido. Revisa:
- Paso 3 (Login): email válido + PIN de 6 dígitos
- Paso 4 (Merchant): External Merchant ID numérico + casilla "Confirmar ID" marcada
- Paso 5 (Slot): si modo `replace`, hay que seleccionar el merchant a reemplazar

### "El TPV dice 'Heartbeat from unactivated terminal'"
La terminal está en estado `PENDING_CREATION`. Ve a `/superadmin/terminals`, busca la terminal y dale **"Activar ahorita"** — eso stamps `activatedAt`.

### "Los números del reporte de revenue-share no coinciden con available-balance"
Es esperado y correcto. El reporte nuevo trabaja **pre-IVA** (IVA es pass-through a SAT, no se reparte). Available-balance usa el legacy `TransactionCost.grossProfit` que incluye IVA en el margen.

Relación: `grossProfit (legacy) / (1 + taxRate) ≈ margen (nuevo reporte)`.

### "Quiero borrar un agregador y no me deja"
Solo se pueden eliminar agregadores SIN merchants ni VenueCommission ligados. Si quieres "ocultarlo" sin perder la referencia, usa el toggle de **Activar/Desactivar** en su tarjeta.

---

## 📚 Referencias técnicas

- Diseño del modelo nuevo: `docs/superpowers/specs/2026-05-22-revenue-share-fee-model-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-05-22-revenue-share-fee-model.md`
- Spec del wizard AngelPay: `docs/superpowers/specs/2026-05-21-angelpay-merchant-wizard-design.md`

## 📞 Cuando algo se rompe

1. **Backend logs**: betterstack (busca por `merchantAccountId` o el venue slug)
2. **TPV crashlytics**: Firebase Crashlytics (TPV side)
3. **Reproducir en local**: `npm run dev` en ambos repos + `DATABASE_URL=postgresql://postgres:exitosoy777@localhost:5432/av-db-25` para tener data
