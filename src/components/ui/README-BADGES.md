# Theme-Aware Badge Components

Components reutilizables para badges siguiendo **THEME-GUIDELINES.md**.

## 📦 Componentes Disponibles

### 1. `<StatusBadge />` - Badge genérico de estado

```tsx
import { StatusBadge } from '@/components/ui/status-badge'

<StatusBadge variant="success">Active</StatusBadge>
<StatusBadge variant="warning">Pending</StatusBadge>
<StatusBadge variant="error">Suspended</StatusBadge>
<StatusBadge variant="info">Trial</StatusBadge>
<StatusBadge variant="neutral">Cancelled</StatusBadge>
```

### 2. `<VenueStatusBadge />` - Badge para estados de venues

```tsx
import { VenueStatusBadge } from '@/components/ui/status-badge'

<VenueStatusBadge status="ACTIVE" label={t('venueMgmt.statuses.ACTIVE')} />
<VenueStatusBadge status="PENDING" label={t('venueMgmt.statuses.PENDING')} />
<VenueStatusBadge status="SUSPENDED" label={t('venueMgmt.statuses.SUSPENDED')} />
<VenueStatusBadge status="CANCELLED" label={t('venueMgmt.statuses.CANCELLED')} />
<VenueStatusBadge status="TRIAL" label={t('venueMgmt.statuses.TRIAL')} />
```

### 3. `<KYCStatusBadge />` - Badge para estados de KYC

```tsx
import { KYCStatusBadge } from '@/components/ui/status-badge'

<KYCStatusBadge status="APPROVED" label="Approved" />
<KYCStatusBadge status="PENDING_REVIEW" label="Pending Review" />
<KYCStatusBadge status="IN_REVIEW" label="In Review" />
<KYCStatusBadge status="REJECTED" label="Rejected" />
<KYCStatusBadge status="NOT_STARTED" label="Not Started" />
```

### 4. `<PaymentStatusBadge />` - Badge para estados de pago

```tsx
import { PaymentStatusBadge } from '@/components/ui/status-badge'

<PaymentStatusBadge status="PAID" label="Paid" />
<PaymentStatusBadge status="PENDING" label="Pending" />
<PaymentStatusBadge status="OVERDUE" label="Overdue" />
<PaymentStatusBadge status="FAILED" label="Failed" />
```

### 5. `<PlanBadge />` - Badge genérico para planes

```tsx
import { PlanBadge } from '@/components/ui/plan-badge'

<PlanBadge variant="starter">Starter</PlanBadge>
<PlanBadge variant="professional">Professional</PlanBadge>
<PlanBadge variant="enterprise">Enterprise</PlanBadge>
<PlanBadge variant="free">Free</PlanBadge>
<PlanBadge variant="custom">Custom</PlanBadge>
```

### 6. `<SubscriptionPlanBadge />` - Badge para planes de suscripción

```tsx
import { SubscriptionPlanBadge } from '@/components/ui/plan-badge'

<SubscriptionPlanBadge plan="STARTER" label={t('venueMgmt.planLabels.STARTER')} />
<SubscriptionPlanBadge plan="PROFESSIONAL" label={t('venueMgmt.planLabels.PROFESSIONAL')} />
<SubscriptionPlanBadge plan="ENTERPRISE" label={t('venueMgmt.planLabels.ENTERPRISE')} />
```

## 🎨 Colores (Theme-Aware)

Todos los componentes incluyen variantes para dark mode siguiendo **THEME-GUIDELINES.md**:

### Success (Verde)
```
Light: bg-green-50 text-green-800 border-green-200
Dark:  bg-green-950/50 text-green-200 border-green-800
```

### Warning (Amarillo)
```
Light: bg-yellow-50 text-yellow-800 border-yellow-200
Dark:  bg-yellow-950/50 text-yellow-200 border-yellow-800
```

### Error (Rojo - usa color semántico)
```
Light & Dark: bg-destructive/10 text-destructive border-destructive/20
```

### Info (Azul)
```
Light: bg-blue-50 text-blue-800 border-blue-200
Dark:  bg-blue-950/50 text-blue-200 border-blue-800
```

### Neutral (Gris)
```
Light & Dark: bg-muted text-muted-foreground border-border
```

## ✅ Ventajas

1. **DRY Principle**: Elimina código duplicado en 93 archivos
2. **Single Source of Truth**: Cambios en un solo lugar
3. **Type Safety**: Props completamente tipados
4. **Theme-Aware**: 100% compatible con light/dark mode
5. **Accesibilidad**: Usa colores semánticos de shadcn/ui
6. **Mantenibilidad**: Fácil de actualizar colores globalmente

## 🚀 Migración

### Antes (código duplicado en cada archivo):
```tsx
const getStatusColor = (status: VenueStatus) => {
  switch (status) {
    case VenueStatus.ACTIVE:
      return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200'
    case VenueStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'
    // ... más casos
  }
}

<Badge className={getStatusColor(venue.status)}>
  {getStatusLabel(venue.status)}
</Badge>
```

### Después (componente reutilizable):
```tsx
import { VenueStatusBadge } from '@/components/ui/status-badge'

<VenueStatusBadge
  status={venue.status}
  label={getStatusLabel(venue.status)}
/>
```

## 📝 Archivos Refactorizados

- ✅ `VenueManagement.tsx` - Migrado completamente
- ⏳ `KYCReview.tsx` - Pendiente
- ⏳ `ProfitAnalyticsDashboard.tsx` - Pendiente
- ⏳ `FeatureManagement.tsx` - Pendiente
- ⏳ 89 archivos más - Pendiente

## 🔗 Referencias

- **THEME-GUIDELINES.md** - Guías de color y tema
- **shadcn/ui Badge** - Componente base
- **Tailwind CSS** - Sistema de diseño
