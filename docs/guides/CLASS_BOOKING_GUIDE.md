# Guía: Sistema de Clases y Reservaciones

Cubre el flujo completo desde crear un producto tipo Clase hasta que los clientes reserven en el widget embebible.

---

## Arquitectura (3 capas)

```
Product (type=CLASS)          ← Plantilla: "Yoga Matutino"
    ↓  define cupo default
ClassSession                  ← Ocurrencia: Lun 8:30–9:15, Personal: Ana
    ↓  los clientes reservan spots
Reservation                   ← Asistente: María González, 1 lugar
```

Esta estructura es idéntica a **Square Appointments**:
- El producto es el **catálogo** (qué se ofrece, precio base, cupo máximo sugerido)
- La sesión es el **evento agendado** (cuándo, con quién, cuántas plazas)
- La reservación es el **boleto del asistente**

---

## 1. Crear un producto tipo CLASE

**Dónde:** `Inventario` → botón `+ Nuevo producto`

### Paso 1: Selector de tipo de producto
Al abrir el wizard, aparece el modal `ProductTypeSelectorModal`. Selecciona **Clase / Taller**.

> La estrella (★) indica los tipos recomendados según la industria del venue.
> Para un gym o spa, `Clase` y `Cita` aparecen como recomendados automáticamente.

### Paso 2: Información básica del producto
En el wizard de inventario (`ProductWizardDialog`):

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Nombre de la clase (ej. "Yoga Matutino", "Spinning Avanzado") |
| **Descripción** | Descripción corta que verá el cliente en el widget |
| **Precio** | Precio por persona (puede ser $0 si es incluida en membresía) |
| **Imagen** | Foto de la clase (opcional, aparece en el widget) |

### Paso 3: Configuración de clase *(sección exclusiva para type=CLASS)*
| Campo | Descripción |
|-------|-------------|
| **Cupo máximo** | Número de plazas por sesión. **Es un default** — puede sobreescribirse por sesión |

> Categoría y grupos de modificadores **no aplican** para clases (se ocultarán en versiones futuras).

### Paso 4: Inventario
Para productos tipo CLASE, la sección de inventario se **omite automáticamente** (no tiene stock físico).

El wizard finaliza con el producto guardado. Ahora aparece en `Inventario` con el badge `CLASE`.

---

## 2. Agendar una sesión de clase

**Dónde:** `Reservaciones` → `Calendario` → botón `+ Nueva clase`

> El botón aparece en la barra de controles del calendario, junto a las opciones de vista.

### Formulario "Agendar clase" *(equivalente a Square "Crear clase")*

| Campo | Descripción |
|-------|-------------|
| **Nombre de la clase** | Dropdown: muestra solo productos con `type=CLASS` y `active=true` |
| **Fecha** | Fecha de la sesión (pre-llenada si hiciste clic en el calendario) |
| **Hora de inicio** | Hora local del venue (se convierte a UTC al guardar) |
| **Hora de finalización** | Debe ser posterior a la hora de inicio |
| **Plazas disponibles** | Pre-llena con el `maxParticipants` del producto. Puede cambiarse por sesión |
| **Personal** | Opcional. Dropdown del equipo del venue |
| **Notas internas** | Solo visible para staff (no para el cliente) |

Al guardar, la sesión aparece como un **bloque violeta** en el calendario.

> **Colores del calendario:**
> - Bloques normales (azul/verde/amarillo) = reservaciones individuales
> - Bloques **violeta** = sesiones de clase (tienen indicador de plazas llenas)

### Crear sesión desde el grid del calendario
También puedes hacer **clic en cualquier espacio vacío** del calendario para abrir el modal con la fecha y hora pre-llenadas.

---

## 3. Gestionar asistentes de una sesión

*(UI de detalle de sesión — pendiente de construir como Phase 2)*

La API ya soporta las siguientes operaciones via `classSessionService`:

```typescript
// Agregar asistente
classSessionService.addAttendee(venueId, sessionId, {
  guestName: 'María González',
  guestPhone: '+52 55 1234 5678',
  guestEmail: 'maria@email.com',
  partySize: 1,
  specialRequests: 'Nivel principiante',
})

// Eliminar asistente (cancela su reservación)
classSessionService.removeAttendee(venueId, sessionId, reservationId)

// Cancelar toda la sesión
classSessionService.cancelClassSession(venueId, sessionId)
// → Cancela automáticamente TODAS las reservaciones activas de la sesión
```

**Reglas de negocio:**
- No se puede agregar asistentes si la sesión está `COMPLETED` o `CANCELLED`
- No se puede reducir el cupo por debajo del número de asistentes ya inscritos
- Una reservación cancelada libera su lugar para otro asistente

---

## 4. Reservaciones individuales (Citas / Mesas)

**Dónde:** `Reservaciones` → botón `+ Nueva reservación` **o** clic en el calendario

Para productos tipo `APPOINTMENTS_SERVICE` (citas) o reservaciones sin producto:

### Flujo del calendar click-to-create
1. Clic en espacio vacío del calendario → modal pre-llena fecha + hora
2. Seleccionar fecha, hora inicio/fin, tamaño del grupo
3. El sistema consulta disponibilidad y sugiere mesas/staff disponibles
4. Asignar cliente existente o ingresar datos de huésped
5. Guardar → bloque aparece en el calendario con el color del status

### Canales de creación (`channel`)
| Canal | Descripción |
|-------|-------------|
| `DASHBOARD` | Creada manualmente desde el dashboard |
| `WEB` | Cliente reservó desde el widget/página pública |
| `PHONE` | Registrada por telefono |
| `WHATSAPP` | Via WhatsApp (integración futura) |
| `WALK_IN` | Llegada sin cita |

---

## 5. Widget embebible para tu website

**Dónde:** `Reservaciones` → `Online Booking`

El widget permite que los clientes reserven **desde cualquier website** sin salir de él.

### Instalación básica (HTML)

```html
<!-- Pegar en cualquier página web antes de </body> -->
<script src="https://cdn.avoqado.io/booking/v1/widget.js"></script>
<avoqado-booking
  venue="mi-restaurante"
  locale="es"
  theme="auto"
></avoqado-booking>
```

### Atributos disponibles

| Atributo | Valores | Descripción |
|----------|---------|-------------|
| `venue` | slug del venue | **Requerido.** Identificador único del venue |
| `locale` | `es` \| `en` | Idioma del widget (default: `es`) |
| `theme` | `auto` \| `light` \| `dark` | Tema visual (auto = sigue el sistema del usuario) |
| `accent-color` | `#hex` | Color de acento personalizado (botones, selecciones) |
| `mode` | `inline` \| `button` \| `popup` | Modo de visualización (default: `inline`) |
| `service-id` | ID del producto | Pre-selecciona un servicio/clase específico |
| `button-text` | string | Texto del botón en modo `button` o `popup` |

### Modos de visualización

**`inline`** — El widget se muestra directamente embebido en la página:
```html
<div class="mi-seccion-reservaciones">
  <avoqado-booking venue="mi-gym" mode="inline"></avoqado-booking>
</div>
```

**`button`** — Muestra solo un botón; al hacer clic abre el flujo:
```html
<avoqado-booking
  venue="mi-gym"
  mode="button"
  button-text="Reservar clase"
  accent-color="#7C3AED"
></avoqado-booking>
```

**`popup`** — Igual que `button` pero también expone API JavaScript:
```javascript
const widget = document.querySelector('avoqado-booking')
widget.open()   // Abrir programáticamente
widget.close()  // Cerrar
```

### WordPress Shortcode

Instalar el plugin Avoqado Booking y usar:
```
[avoqado_booking venue="mi-restaurante" locale="es" theme="auto"]
```

### Integración con Analytics (eventos DOM)

```javascript
document.querySelector('avoqado-booking')
  .addEventListener('avoqado:confirmed', (e) => {
    // Dispara al confirmar una reservación
    const { confirmationCode, startsAt, endsAt, productName } = e.detail

    // Ejemplo: enviar a Google Analytics
    gtag('event', 'booking_confirmed', {
      event_category: 'bookings',
      event_label: productName,
      value: 1,
    })

    // Ejemplo: Facebook Pixel
    fbq('track', 'Purchase', { currency: 'MXN', value: e.detail.depositAmount })
  })

// También disponible:
// 'avoqado:cancelled' → cuando el cliente cancela
// 'avoqado:step-changed' → cuando avanza o retrocede en el flujo
```

### Configuración del widget en el dashboard

Desde `Reservaciones → Online Booking`:
1. **Activar/desactivar** la reservación online desde el toggle
2. **Personalizar** locale, theme y mode — el snippet de código se actualiza en tiempo real
3. **Vista previa** del widget tal como lo verá el cliente
4. Copiar el código HTML, shortcode de WordPress, o comando npm

---

## 6. Configuración de disponibilidad

**Dónde:** `Reservaciones` → `Configuración`

### Horarios operativos
Define los días y rangos de apertura/cierre. El widget automáticamente bloquea fechas fuera de horario.

### Parámetros clave

| Parámetro | Descripción |
|-----------|-------------|
| **Slot interval** | Cada cuántos minutos se ofrecen horarios (ej. 15, 30, 60 min) |
| **Duración default** | Duración estándar de una reservación sin producto específico |
| **Auto-confirmar** | Si está activo, reservaciones quedan en `CONFIRMED` al crearlas |
| **Días max de anticipación** | Hasta cuántos días a futuro puede reservar el cliente |
| **Aviso mínimo** | Mínimo de horas antes que el cliente puede reservar |
| **Cupo por slot** | Límite de reservaciones simultáneas (pacing) |
| **Capacidad online** | Porcentaje del cupo disponible para reservas online (ej. 80% = guarda 20% para walk-ins) |

### Depósitos
| Modo | Descripción |
|------|-------------|
| `Ninguno` | No requiere pago anticipado |
| `Retención de tarjeta` | Guarda la tarjeta pero no cobra |
| `Depósito parcial` | Cobra un porcentaje o monto fijo |
| `Prepago total` | Requiere pago completo para confirmar |

---

## 7. Lista de espera

**Dónde:** `Reservaciones` → `Lista de espera`

Cuando no hay disponibilidad, los clientes pueden anotarse en la lista de espera. Cuando se libera un lugar:

- **FIFO** (`fifo`): El primero en anotarse recibe la notificación
- **Por tamaño de grupo** (`party_size`): Prioriza grupos más grandes
- **Broadcast** (`broadcast`): Notifica a todos al mismo tiempo; el primero en responder gana

---

## 8. Flujo completo: de la clase al cliente

```
1. Staff crea Product(type=CLASS) "Pilates Reformer"
   → nombre, precio, cupo default: 8 personas

2. Staff agenda ClassSession en el calendario
   → Jue 23/02, 10:00–11:00, Ana López (instructora), 8 plazas

3. Cliente visita website del gym
   → Ve el widget <avoqado-booking venue="mi-gym">
   → Selecciona "Pilates Reformer"
   → Elige fecha Jue 23/02, slot 10:00
   → Ingresa nombre + teléfono
   → Confirma → Recibe código de confirmación

4. Reservation creada: status=CONFIRMED, channel=WEB
   → ClassSession.reservedCount: 1 → 2 → ... → 8 (llena)
   → Widget bloquea el slot automáticamente cuando llega a 8

5. Dashboard muestra la sesión con el bloque violeta en el calendario
   → Staff puede ver: 8/8 plazas, lista de asistentes
   → Puede agregar asistente manualmente (canal DASHBOARD)

6. El día de la clase:
   → Staff marca asistentes como CHECKED_IN
   → Al terminar: sesión pasa a COMPLETED

7. Analytics recibe evento 'avoqado:confirmed' en el website del cliente
   → GTM/GA4 registra la conversión
```

---

## Diferencias vs Square Appointments

| Feature | Square | Avoqado |
|---------|--------|---------|
| Clases grupales | Premium ($69/mo) | ✅ Incluido |
| Multi-venue | $69/mo extra | ✅ Desde el inicio |
| Widget embebible | ✅ Con branding Square | ✅ White-label |
| WhatsApp | ✗ | ✅ (Fase 2) |
| MSI / CFDI | ✗ | ✅ |
| Capacidad online (%) | "filtro falso" oculto | ✅ `onlineCapacityPercent` configurable |
| Lista de espera | Solo web (sin SMS) | 3 modos + notificaciones |
| Depósitos | Stripe solo | Blumon + Stripe |
