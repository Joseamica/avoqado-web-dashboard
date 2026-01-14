# WHITE_LABEL_DASHBOARD - Sistema de Dashboards Personalizados

## Resumen

El módulo `WHITE_LABEL_DASHBOARD` permite crear experiencias de dashboard completamente personalizadas para clientes enterprise (PlayTelecom, joyerías, etc.) sin escribir código. Utiliza un sistema de **Feature Registry** y un **Visual Builder** (wizard de 4 pasos) para configurar dashboards con branding personalizado.

**Principios Clave:**
- **Feature Registry**: Catálogo central de features reutilizables
- **Visual Builder**: UI de wizard sin JSON para configurar dashboards
- **Composición**: Dashboards pueden incluir features de Avoqado (Commissions, Tips) + features específicos
- **Sin hardcoding**: Nunca `if (venue.slug === 'playtelecom')` - siempre módulos

---

## Arquitectura

### Modelo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                         Module (BD)                              │
├─────────────────────────────────────────────────────────────────┤
│ code: "WHITE_LABEL_DASHBOARD"                                    │
│ name: "White-Label Dashboard"                                    │
│ defaultConfig: { version, theme, enabledFeatures, navigation }  │
│ presets: { telecom: {...}, jewelry: {...}, retail: {...} }      │
│ active: true                                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VenueModule (BD)                            │
├─────────────────────────────────────────────────────────────────┤
│ venueId: "venue-uuid"                                            │
│ moduleId: "module-uuid"                                          │
│ enabled: true                                                    │
│ config: { theme, enabledFeatures, navigation, featureConfigs }  │
│ enabledBy: "staff-uuid"                                          │
│ enabledAt: DateTime                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Feature Registry

El Feature Registry (`src/config/feature-registry.ts`) define todas las features disponibles:

```typescript
interface FeatureDefinition {
  code: string                    // Ej: 'AVOQADO_COMMISSIONS'
  name: string                    // Nombre para mostrar
  description: string             // Descripción
  category: 'analytics' | 'sales' | 'inventory' | 'team' | 'custom'
  source: 'avoqado_core' | 'module_specific'

  component: {
    path: string                  // Lazy import path
    layout?: string
  }

  routes: Array<{
    path: string
    element: string
    roles?: StaffRole[]
  }>

  configSchema: JSONSchema        // Para forms dinámicos

  defaultNavItem: {
    label: string
    icon: string
  }
}
```

**Features Disponibles:**

### Avoqado Core (17 features activas)
Reutilizables en cualquier dashboard white-label:

| Code | Nombre | Categoría | Descripción |
|------|--------|-----------|-------------|
| `AVOQADO_DASHBOARD` | Dashboard | analytics | Panel principal con métricas del día |
| `AVOQADO_ORDERS` | Órdenes | sales | Gestión de órdenes e historial |
| `AVOQADO_PAYMENTS` | Pagos | sales | Historial de pagos y transacciones |
| `AVOQADO_MENU` | Menú | inventory | Productos, categorías, modificadores |
| `AVOQADO_INVENTORY` | Inventario | inventory | Control de stock e ingredientes |
| `AVOQADO_TEAM` | Equipo | team | Gestión de personal y roles |
| `AVOQADO_CUSTOMERS` | Clientes | sales | Base de datos de clientes |
| `AVOQADO_TPVS` | Terminales | analytics | Gestión de terminales POS |
| `AVOQADO_BALANCE` | Balance | analytics | Balance disponible y depósitos |
| `AVOQADO_PROMOTIONS` | Promociones | sales | Descuentos y cupones |
| `AVOQADO_ANALYTICS` | Analítica | analytics | Análisis avanzado de ventas |
| `AVOQADO_SHIFTS` | Turnos | team | Control de turnos y caja |
| `AVOQADO_COMMISSIONS` | Comisiones | team | Sistema de comisiones |
| `AVOQADO_LOYALTY` | Lealtad | sales | Programa de puntos y recompensas |
| `AVOQADO_REVIEWS` | Reseñas | sales | Gestión de reseñas y Google Reviews |
| `AVOQADO_REPORTS` | Reportes | analytics | Reportes de ventas |

> ⚠️ **Pendiente:** `AVOQADO_TIPS` está comentado porque la página `@/pages/Tips/TipsPage` no existe aún.

### Módulos Específicos (6 features)
Features específicos para verticales de negocio:

**Telecom/Retail:**
| Code | Nombre | Categoría | Descripción |
|------|--------|-----------|-------------|
| `COMMAND_CENTER` | Centro de Comando | analytics | Dashboard en tiempo real para telecom |
| `SERIALIZED_STOCK` | Inventario Serializado | inventory | Control con IMEI/números de serie |
| `PROMOTERS_AUDIT` | Auditoría de Promotores | team | Seguimiento de promotores de campo |
| `STORES_ANALYSIS` | Análisis de Tiendas | analytics | Comparativas y métricas por tienda |

**Joyería:**
| Code | Nombre | Categoría | Descripción |
|------|--------|-----------|-------------|
| `APPRAISALS` | Avalúos | sales | Sistema de valuación de joyería |
| `CONSIGNMENT` | Consignación | inventory | Gestión de productos en consignación |

---

## Flujo de Configuración

### Visual Builder (4 Pasos)

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: SETUP                                                   │
│  • Seleccionar Venue (dropdown)                                  │
│  • Seleccionar Preset: [telecom] [jewelry] [retail] [custom]    │
│  • Branding: nombre, logo, color primario                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: FEATURES                                                │
│  • AVOQADO CORE: [✅] Comisiones  [✅] Propinas                  │
│  • PRESET: [✅] Centro Comando  [✅] Inventario                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: CONFIGURATION                                           │
│  • Forms dinámicos por feature (generados desde configSchema)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: PREVIEW                                                 │
│  • Preview visual del dashboard                                  │
│  • Drag & drop para reordenar navegación                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [Guardar y Habilitar]
```

### Acceso al Wizard

1. Ir a **Superadmin → Module Management**
2. Buscar el módulo `WHITE_LABEL_DASHBOARD`
3. Click en acciones → **"Configure Dashboard"**

---

## Archivos del Sistema

### Frontend (avoqado-web-dashboard)

| Archivo | Propósito |
|---------|-----------|
| `src/types/white-label.ts` | Interfaces TypeScript |
| `src/config/feature-registry.ts` | Catálogo de features |
| `src/config/white-label-presets.ts` | Presets predefinidos |
| `src/hooks/useWhiteLabelConfig.ts` | Hook para acceder config |
| `src/pages/WhiteLabel/WhiteLabelDashboardLayout.tsx` | Layout con branding dinámico |
| `src/pages/WhiteLabel/WhiteLabelIndex.tsx` | Página index |
| `src/pages/WhiteLabel/WhiteLabelFeatureRouter.tsx` | Router dinámico |
| `src/components/WhiteLabel/DynamicFeatureLoader.tsx` | Carga lazy de componentes |
| `src/pages/Superadmin/WhiteLabelBuilder/WhiteLabelWizard.tsx` | Wizard orquestador |
| `src/pages/Superadmin/WhiteLabelBuilder/steps/Step1Setup.tsx` | Setup inicial |
| `src/pages/Superadmin/WhiteLabelBuilder/steps/Step2Features.tsx` | Selección de features |
| `src/pages/Superadmin/WhiteLabelBuilder/steps/Step3Configuration.tsx` | Config por feature |
| `src/pages/Superadmin/WhiteLabelBuilder/steps/Step4Preview.tsx` | Preview y navegación |

### Backend (avoqado-server)

| Archivo | Propósito |
|---------|-----------|
| `src/services/modules/module.service.ts` | Servicio de módulos |
| `src/controllers/dashboard/modules.superadmin.controller.ts` | Controller de superadmin |

---

## Creación del Módulo

### Paso 1: Crear el módulo en la BD

Ir a **Superadmin → Module Management → Create Module** y usar estos valores:

```json
{
  "code": "WHITE_LABEL_DASHBOARD",
  "name": "White-Label Dashboard",
  "description": "Custom dashboard builder for branded venue experiences",
  "defaultConfig": {
    "version": "1.0",
    "theme": {
      "primaryColor": "#000000",
      "logo": null,
      "brandName": null
    },
    "enabledFeatures": [],
    "navigation": {
      "layout": "sidebar",
      "items": []
    },
    "featureConfigs": {}
  },
  "presets": {
    "telecom": {
      "theme": { "primaryColor": "#FF6B00" },
      "enabledFeatures": [
        { "code": "COMMAND_CENTER", "source": "module_specific" },
        { "code": "SERIALIZED_STOCK", "source": "module_specific" },
        { "code": "PROMOTERS_AUDIT", "source": "module_specific" },
        { "code": "AVOQADO_COMMISSIONS", "source": "avoqado_core" }
      ]
    },
    "jewelry": {
      "theme": { "primaryColor": "#C9A962" },
      "enabledFeatures": [
        { "code": "SERIALIZED_STOCK", "source": "module_specific" },
        { "code": "AVOQADO_COMMISSIONS", "source": "avoqado_core" }
      ]
    },
    "retail": {
      "theme": { "primaryColor": "#3B82F6" },
      "enabledFeatures": [
        { "code": "AVOQADO_COMMISSIONS", "source": "avoqado_core" },
        { "code": "AVOQADO_TIPS", "source": "avoqado_core" }
      ]
    }
  }
}
```

### Paso 2: Habilitar para un venue

1. En Module Management, click en el módulo WHITE_LABEL_DASHBOARD
2. Click en **"Configure Dashboard"** para abrir el wizard
3. Completar los 4 pasos del wizard
4. Guardar configuración

---

## Validación Dinámica de Módulos

### Cambio Importante (Backend)

El backend ahora valida módulos **dinámicamente contra la base de datos** en lugar de usar una lista hardcodeada.

**Antes (hardcoded):**
```typescript
// ❌ INCORRECTO - Lista estática
if (!Object.values(MODULE_CODES).includes(moduleCode)) {
  return res.status(400).json({ error: `Invalid module code` })
}
```

**Ahora (dinámico):**
```typescript
// ✅ CORRECTO - Validación contra BD
const moduleExists = await prisma.module.findUnique({
  where: { code: moduleCode },
  select: { id: true, active: true },
})

if (!moduleExists) {
  return res.status(400).json({ error: `Invalid module code: ${moduleCode}` })
}

if (!moduleExists.active) {
  return res.status(400).json({ error: `Module ${moduleCode} is not active` })
}
```

Esto permite crear nuevos módulos sin modificar el código del backend.

---

## Eliminación de Código Hardcodeado

### Sidebar (app-sidebar.tsx)

Se eliminó todo el código hardcodeado de PlayTelecom del sidebar:

**Eliminado:**
- `hasPlayTelecomModule` - verificación hardcodeada
- `isPlayTelecomMode` - estado de localStorage
- Bloque de navegación PlayTelecom (líneas 177-271)
- Sección PlayTelecom en menú normal (líneas 473-537)
- Imports no usados: `Switch`, `Label`, `checkModuleAccess`

**Nuevo comportamiento:**
El sidebar ahora usa el hook `useWhiteLabelConfig()` para detectar si hay un white-label dashboard configurado y mostrar la navegación correspondiente.

---

## Rutas

### Rutas White-Label

```
/venues/:slug/wl                  → WhiteLabelDashboardLayout
/venues/:slug/wl/:featureSlug/*   → WhiteLabelFeatureRouter → DynamicFeatureLoader
```

### Protección de Rutas

```typescript
<Route
  path="wl"
  element={<ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" />}
>
  <Route element={<WhiteLabelDashboardLayout />}>
    <Route index element={<WhiteLabelIndex />} />
    <Route path=":featureSlug/*" element={<WhiteLabelFeatureRouter />} />
  </Route>
</Route>
```

---

## Traducciones

Namespace: `superadmin` (sección `whiteLabelWizard`)

Archivos:
- `src/locales/en/superadmin.json`
- `src/locales/es/superadmin.json`

Claves principales:
- `whiteLabelWizard.title`
- `whiteLabelWizard.steps.*`
- `whiteLabelWizard.setup.*`
- `whiteLabelWizard.features.*`
- `whiteLabelWizard.configuration.*`
- `whiteLabelWizard.preview.*`

---

## Uso del Hook

```typescript
import { useWhiteLabelConfig } from '@/hooks/useWhiteLabelConfig'

function MyComponent() {
  const {
    isWhiteLabelEnabled,  // boolean - si el módulo está activo
    config,               // WhiteLabelConfig | null
    theme,                // WhiteLabelTheme
    enabledFeatures,      // EnabledFeature[]
    navigation,           // NavigationItem[]
    getFeatureConfig,     // (code: string) => Record<string, unknown> | null
    isFeatureEnabled,     // (code: string) => boolean
  } = useWhiteLabelConfig()

  if (!isWhiteLabelEnabled) {
    return <NormalDashboard />
  }

  return <WhiteLabelDashboard theme={theme} />
}
```

---

## Troubleshooting

### "Invalid module code: WHITE_LABEL_DASHBOARD"

**Causa:** El módulo no existe en la base de datos.

**Solución:** Crear el módulo usando el formulario en Module Management con el JSON proporcionado arriba.

### Venues no cargan en el wizard

**Causa:** El endpoint de venues no existía.

**Solución:** El wizard ahora usa `getAllVenues()` del servicio `superadmin.service.ts`.

### El sidebar no muestra navegación white-label

**Causa:** El módulo no está habilitado para el venue actual.

**Solución:**
1. Verificar que el módulo WHITE_LABEL_DASHBOARD esté activo
2. Verificar que esté habilitado para el venue específico
3. Verificar que `VenueModule.config` tenga navegación configurada

---

## Referencias

- Plan de implementación: `~/.claude/plans/soft-napping-swing.md`
- Servicio de módulos: `avoqado-server/src/services/modules/module.service.ts`
- Feature Registry: `src/config/feature-registry.ts`
- Hook principal: `src/hooks/useWhiteLabelConfig.ts`
