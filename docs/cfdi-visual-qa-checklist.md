# CFDI / Facturación — Checklist de QA visual

> Auditoría de **código** ya hecha (bugs reales corregidos). Esto es lo que falta: **ojos en el render**.
> Marca cada caja. Si algo se ve mal, anótalo abajo de su sección.

## Setup (1 vez)
- Dashboard apuntando a tu **backend local** (`VITE_API_URL=http://localhost:3000` en `.env.development.local`), `npm run dev`.
- **Venue CON CFDI (desbloqueado):** `Avoqado Full` (o `Avoqado Wellness`). **Venue SIN CFDI (teaser):** `play-telecom` / `pw-direct`.
- Probar cada pantalla en **claro + oscuro** y en **ancho móvil** (DevTools → ~390px).

---

## 1. Sidebar
- [ ] En cualquier venue aparece el grupo **"Facturación"** (ya no se oculta).
- [ ] Venue SIN CFDI: el item trae **estrella verde** ⭐ (tooltip "Incluido en el Plan Pro"); al hover se ve.
- [ ] Venue CON CFDI: sin estrella; los sub-items "Facturas" y "Configuración" navegan normal (NO a "kyc-required").
- [ ] Colapsado el sidebar: el ícono se ve bien (la estrella no aparece colapsado — esperado).

## 2. Teaser / Paywall (venue SIN CFDI)
- [ ] Entrar a **Facturas** y **Configuración**: se ven las primeras filas/tarjetas y el resto **difuminado**.
- [ ] Tarjeta central **"Contrata el Plan Pro"** centrada, legible, botón funciona → lleva a `settings/billing`.
- [ ] No se puede hacer click en lo difuminado (acciones bloqueadas).
- [ ] Oscuro + móvil: el blur y la tarjeta se ven bien, sin recortes.

## 3. Facturas (lista) — venue CON CFDI
- [ ] Tabla carga (si no hay CFDIs → "Sin resultados", correcto).
- [ ] **Filtros en una sola fila**: 🔍 lupa → date range → Estatus → Flujo.
- [ ] Lupa: abre input redondo con ícono adentro + ✕; busca por RFC (con debounce, no traba).
- [ ] **Estatus/Flujo: single-select** — al elegir uno, el badge dice "1"; elegir otro reemplaza (no acumula a "2").
- [ ] Rango de fechas: elige "Hoy" → trae solo hoy (no corrido un día).
- [ ] Cambiar un filtro estando en página >1 → vuelve a página 1 (no pantalla vacía).
- [ ] Montos en **pesos** correctos (ej. $522.00, no $52,200).
- [ ] Menú "⋯" por fila: Descargar XML/PDF (abren), **Cancelar** (solo OWNER/ADMIN) → diálogo con motivo 01-04.
- [ ] Oscuro + móvil: tabla/filtros legibles.

## 4. Configuración Fiscal — venue CON CFDI (necesita permiso `cfdi:configure`)
**Emisores**
- [ ] Tarjetas con RFC, razón social, badge de **CSD** (NONE/ACTIVE/EXPIRED + vencimiento), serie, periodicidad.
- [ ] "Nuevo emisor" / "Editar" → modal pantalla completa; valida RFC, régimen (3 díg), CP (5 díg).
- [ ] "Conectar al PAC" (si no provisionado): al clickear **solo ese** botón gira (no todos).
- [ ] "Subir CSD": modal con .cer + .key + contraseña; sin archivos no deja; muestra error claro.

**Comercios**
- [ ] Lista de comercios con config: 3 switches (facturación / autofactura / incluir en global) + selector de emisor.
- [ ] **"Agregar comercio"**: dropdown con merchants SIN config (etiqueta Presencial/En línea) + emisor → "Agregar".
- [ ] Si no hay merchants sin config → "todos los comercios ya están configurados".
- [ ] (Si el venue no tiene merchant accounts, solo salen los de e-commerce — esperado, no crashea).

**Factura global**
- [ ] Tarjeta por emisor con periodicidad + nota si CSD inactivo (botón deshabilitado).
- [ ] "Generar factura global ahora" → diálogo de confirmación → dispara.
- [ ] Estados (probar con emisor real): timbrada (toast + "Ver PDF") / "no hay tickets" / CSD inactivo / errores.

## 5. Flow B — Facturar una cuenta (desde una orden)
- [ ] En el detalle de una orden pagada → menú **"Acciones"** → botón **"Facturar"** (solo con permiso + CFDI).
- [ ] Modal con receptor: RFC, razón social, **Régimen** (select), CP, **Uso CFDI** (select), correo (opcional).
- [ ] RFC inválido / CP no-5-díg → bloquea con mensaje en español.
- [ ] Datos malos → 422 → **panel rojo con las razones**, el modal **NO se cierra**.
- [ ] Timbrado OK → toast con serie-folio + UUID; la lista de Facturas se refresca.

## 6. Flow A — Autofactura del cliente (página PÚBLICA del recibo)
> Abre un recibo digital: `http://localhost:5173/receipts/public/<accessKey>` (saca un accessKey de un pago con recibo).
- [ ] **Sin login** se ve el recibo + el panel de autofactura (mobile-first).
- [ ] Cuenta no facturada → botón **"Facturar mi cuenta"** → diálogo con receptor (correo **obligatorio** aquí).
- [ ] Timbrado OK → "¡Factura generada!" + descargar **PDF y XML**.
- [ ] Cuenta **ya facturada** → muestra "ya está facturada" + descargar **PDF y XML** (no el form).
- [ ] **Importante (bug que arreglé):** una cuenta **cancelada** debe dejar **re-facturar** (NO mostrar "ya facturada" con PDF cancelado).
- [ ] Merchant sin autofactura → mensaje "no disponible" (no rompe).
- [ ] Oscuro + móvil: todo legible, botones tappables.

## 7. Claves SAT (producto / categoría) — venue CON CFDI
- [ ] En el wizard de **producto** aparece la sección **"Datos fiscales (CFDI)"** (solo si CFDI).
- [ ] Picker de **clave de producto** y **clave de unidad**: escribe → busca en catálogo SAT (debounce), muestra `clave — descripción`, se puede limpiar.
- [ ] **ObjetoImp**: select con 02 (default) / 01 / 03 / 04.
- [ ] Editar un producto existente → precarga las claves guardadas.
- [ ] En **categoría** (wizard + edición): claves SAT por defecto.
- [ ] Venue **SIN** CFDI: la sección **NO aparece** en producto ni categoría.

---

## Anotaciones (lo que se vea mal)
- Pantalla: …
- Pantalla: …
