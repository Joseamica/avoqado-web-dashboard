# Avoqado — Landing Page Brief

> Documento exhaustivo para el LLM responsable del landing page. Extraido directamente del codebase de produccion (avoqado-web-dashboard +
> avoqado-server). Fecha: 2026-03-17

---

## 1. Identidad del Producto

**Nombre:** Avoqado **Tipo:** Plataforma SaaS multi-tenant de gestion empresarial todo-en-uno **Mercado:** Negocios fisicos en Mexico y
LATAM **Propuesta de valor:** POS, pagos, inventario, CRM, analytics, reservaciones, e-commerce — todo en un solo ecosistema

### Filosofia de Diseno UX

> "Disenado para el usuario menos tecnico. Cada pantalla, componente e interaccion debe ser inmediatamente comprensible sin un manual. Menos
> opciones visibles a la vez, jerarquia visual clara. Cuando haya duda, simplificar — menos opciones siempre ganan sobre mas flexibilidad.
> Bonito, limpio y obvio siempre gana sobre denso y complejo."

### Stack Tecnologico

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **Backend:** Express + TypeScript + Prisma ORM + PostgreSQL
- **Auth:** Firebase Authentication (email, Google OAuth, passkeys/biometricos)
- **Real-time:** Socket.IO
- **Hosting:** Cloudflare Pages (frontend) + Render (backend)
- **CI/CD:** GitHub Actions
- **Monitoreo:** BetterStack (Telemetry + Uptime)

---

## 2. Plataformas (11 total)

| Plataforma                    | Descripcion                                                                          | Estado     |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| **Dashboard Web**             | Panel de control principal para gestion del negocio                                  | Produccion |
| **TPV Android (AvoqadoPOS)**  | App punto de venta para terminales PAX y dispositivos Android                        | Produccion |
| **App Android**               | App movil separada del TPV para staff y clientes                                     | Produccion |
| **App iOS**                   | App movil para iOS con 114 archivos Swift, rutas completas                           | Produccion |
| **Modo Kiosko**               | Self-service para pedidos sin mesero (UI completa con screens dedicados)             | Produccion |
| **SDK de Checkout**           | SDK para integrar pagos en sitios web de terceros (API keys, tokenizacion, webhooks) | Produccion |
| **Dashboard White-Label**     | Dashboards personalizados con marca del cliente, rutas independientes                | Produccion |
| **Pagina de Booking Publica** | Reservaciones online sin login (/book/:venueSlug)                                    | Produccion |
| **Viewer de Recibos**         | Recibos digitales accesibles via link publico                                        | Produccion |
| **Portal de Clientes**        | Registro, login, historial de ordenes, credit packs para clientes finales            | Produccion |
| **Menu QR**                   | Menu digital accesible via QR (en desarrollo)                                        | Beta       |

---

## 3. Industrias y Verticales (35+ tipos de negocio)

### Alimentos y Bebidas

- Restaurantes (full-service)
- Comida rapida (quick-service)
- Bares / Antros / Pubs
- Cafeterias / Coffee shops
- Panaderias / Pastelerias
- Food trucks / Puestos moviles
- Catering
- Cocinas ocultas / Dark kitchens

### Comercio / Retail

- Tiendas generales
- Tiendas de conveniencia (estilo OXXO)
- Ropa y boutiques
- Electronica y celulares
- Farmacias
- **Telecomunicaciones** (con modulo especializado PlayTelecom)
- Joyerias (con modulo especializado de avaluos y consignacion)
- Librerias, Ferreterias, Licorerias, Mueblerias, Tiendas de mascotas

### Servicios

- Salones de belleza / Esteticas / Barberias
- Spas / Centros de bienestar
- Gimnasios / Fitness studios
- Clinicas medicas y dentales
- Veterinarias
- Talleres mecanicos / Autolavados
- Lavanderias / Tintorerias
- Talleres de reparacion

### Hospedaje

- Hoteles
- Hostales
- Resorts

### Entretenimiento

- Cines
- Antros / Clubs nocturnos
- Salones de eventos
- Arcades / Centros de juegos
- Boliches

---

## 4. Funcionalidades Completas

### 4.1 Sistema de Pagos y Finanzas

**Multi-procesador:**

- **Menta** — procesador principal con smart caching de terminal IDs
- **Blumon** — hosted checkout con reconciliacion de 4 capas (Android SDK → Blumon → Backend → Webhook)
- **Clip** — procesador de pagos wallet
- **B4Bit** — criptomonedas (BTC, ETH, USDT) con verificacion HMAC-SHA256
- **Stripe** — billing, suscripciones, deposits (SetupIntent)
- **Bank Direct** — transferencias bancarias directas

**Metodos de pago soportados:**

- Efectivo
- Tarjeta de credito
- Tarjeta de debito
- Wallet digital
- Transferencia bancaria
- Criptomonedas (BTC, ETH, USDT)

**Payment Links (Ligas de Pago):**

- Links compartibles con shortCode de 8 caracteres
- Montos fijos o abiertos
- Links reusables o de un solo uso
- Fecha de expiracion configurable
- Campos personalizados (texto, select)
- Propinas configurables (presets + personalizado)
- Propositos: Pago generico, Venta de producto (con deduccion de inventario), Donacion
- Branding personalizable por venue
- Tracking de monto total recolectado

**Balance y Finanzas:**

- Balance disponible con desglose por tipo de tarjeta
- Timeline historico de balance
- Calendario de liquidaciones
- Simulador de transacciones (estimar costos antes de procesar)
- Proyeccion de balance futuro
- Settlement incidents (deteccion, confirmacion, escalamiento)
- Invoices (draft, pending, paid, overdue, cancelled)
- Fee schedules (porcentaje, fijo, escalonado)
- Credit offers (evaluacion crediticia para venues)
- Billing portal (Stripe integrado)

**Cortes de Caja:**

- Tracking efectivo esperado vs real
- Deteccion de varianza (sobrante/faltante)
- Metodos de deposito: banco, caja fuerte, retiro del dueno
- Auditoria por staff

**Proximamente:** Disputas de pago, Terminal virtual (cobrar desde dashboard), Suscripciones recurrentes

---

### 4.2 Punto de Venta (TPV / POS)

**Hardware soportado:**

- Terminales PAX (A910S, etc.)
- Terminales Ingenico (D220, etc.)
- Terminales Verifone (VX520, etc.)
- Impresoras de recibos y cocina
- Kitchen Display System (KDS)

**Funcionalidades:**

- Login por PIN (rapido, por venue) o biometricos/passkey
- Multi-merchant: una terminal puede usar multiples cuentas
- Procesador preferido configurable por terminal
- Modo Kiosko (self-service) con UI completa
- Operacion offline con sincronizacion posterior

**Gestion Remota de Terminales:**

- Comandos remotos: Lock/Unlock, Restart, Shutdown, Modo mantenimiento
- Actualizaciones OTA: Force update, Request update, Install version (rollback)
- Gestion de datos: Sync forzado, Factory reset, Export de logs, Clear cache
- Configuracion remota: Push config, Refresh menu, Cambio de merchant
- Comandos masivos (Bulk) a multiples terminales
- Comandos programados (Cron-based, ej: restart diario a las 3am)
- Geofencing: reglas basadas en ubicacion
- Auditoria completa: historial inmutable de todos los comandos

**Monitoreo y Observabilidad:**

- Health metrics: Heartbeat cada 5 min (bateria, memoria, CPU, uptime)
- Logs en tiempo real via Socket.IO
- Alertas proactivas
- Tracking de ubicacion GPS
- Estado online/offline, version de app

**Sistema de Activacion:**

- Codigo de activacion de 6 caracteres (expira en 7 dias)
- Anti-brute force (max 5 intentos)
- Activacion remota por superadmin

---

### 4.3 Gestion de Ordenes

**Tipos de orden:** Dine-in, Takeout, Delivery, Pickup

**Fuentes de orden:** TPV, Kiosko, QR, Web, App iOS, App Android, Telefono, POS, Payment Link

**Funcionalidades:**

- Ciclo de vida completo (creacion → preparacion → entrega → cierre)
- Kitchen status tracking (KDS)
- Historial de acciones por orden
- Grupos de modificadores
- Ordenes multi-cliente
- Recibos digitales (con acceso publico + review desde recibo)
- Verificacion de ventas
- Split de pagos

**Floor Plan y Mesas:**

- CRUD de mesas con posicionamiento visual (x, y)
- Formas: cuadrada, redonda, rectangular
- Estados: disponible, ocupada, reservada
- Areas y elementos de piso (paredes, puertas, decoracion)
- Diseno del layout fisico del restaurante en el TPV

---

### 4.4 MenuMaker (Gestion de Menu y Productos)

**7 tipos de producto:**

1. **Regular** — Productos fisicos (retail, mercancia)
2. **Food & Beverage** — Comida y bebida (con flag de alcoholico)
3. **Appointments/Service** — Servicios con cita (cortes, masajes)
4. **Class** — Clases grupales con capacidad por sesion (yoga, pilates)
5. **Event** — Tickets de eventos (conciertos, experiencias)
6. **Digital** — Productos digitales (ebooks, cursos, descargas)
7. **Donation** — Donaciones (propinas, causas, redondeo)

**Funcionalidades:**

- Menus multiples por venue
- Categorias y subcategorias
- Grupos de modificadores (extras, opciones)
- Credit Packs (paquetes de creditos prepagados)
- Importacion de menus
- Inventario-aware en modificadores

---

### 4.5 Inventario

**General:**

- Tracking de stock con metodo FIFO
- Materias primas con categorias (lacteos, carnes, vegetales, frutas, granos, condimentos, bebidas, empaque, limpieza)
- Recetas con lineas de receta (conversion de unidades)
- Movimientos de inventario (entrada, salida, ajuste, transferencia)
- Alertas de stock bajo configurables
- Conteos de stock (parcial/completo)
- Lotes (batches) con fecha de expiracion
- Metodos de costeo: FIFO, LIFO, Weighted Average

**Cadena de Suministro:**

- Gestion de proveedores completa
- Ordenes de compra (draft → submitted → received → cancelled)
- Pricing por proveedor por materia prima
- Politicas de precios (fixed, markup %, markup fixed, cost-plus)
- Conversion de unidades entre categorias

**Inventario Serializado (Modulo PlayTelecom):**

- Tracking por numero de serie / IMEI
- Estados: available, reserved, sold, returned, defective, warranty_claim, lost, write_off, in_transit
- Registro masivo de items
- Dashboard de stock con metricas y charts
- Reportes de ventas por item serializado

---

### 4.6 Gestion de Personal y Equipos

**9 niveles jerarquicos:**

1. VIEWER — Solo lectura
2. HOST — Operaciones con clientes (reservaciones, asientos)
3. WAITER — Gestion de pedidos
4. CASHIER — Procesamiento de pagos
5. KITCHEN — Operaciones de cocina (KDS)
6. MANAGER — Gestion operativa y de staff
7. ADMIN — Configuracion del venue completa
8. OWNER — Acceso total al venue
9. SUPERADMIN — Acceso total al sistema

**Funcionalidades:**

- Asignacion multi-venue por staff
- Soporte multi-organizacion
- Invitaciones por email (con flujo de aceptacion)
- 50+ permisos granulares (menu:read, payments:refund, etc.)
- Permission sets personalizados reusables
- Configuracion de roles custom por venue
- Passkey authentication (Face ID, Touch ID via WebAuthn)
- Control de tiempo: Clock-in/out, Breaks, Time entries, Tracking de asistencia
- Password reset con rate limiting

---

### 4.7 CRM y Clientes

- Base de datos de clientes por venue
- Grupos de clientes (VIP, frecuentes) con reglas de auto-asignacion
- Programa de lealtad basado en puntos
- Tags y notas personalizadas ("Alergico a nueces", "Cumple en Dic")
- Tracking de visitas y gasto total
- Valor promedio de orden
- Preferencia de idioma y consentimiento de marketing
- Historial completo (ordenes, lealtad, descuentos, cupones)

---

### 4.8 Promociones y Descuentos

- Descuentos: porcentaje, monto fijo, por producto, categoria u orden completa
- Descuentos especificos por cliente o grupo
- Cupones: generacion de codigos, tracking de redenciones, limites de uso, fechas de vigencia

---

### 4.9 Reservaciones y Bookings

- Estados: Pendiente → Confirmada → Check-in → Completada | Cancelada | No-show
- Canales: Dashboard, Web publica, Telefono, WhatsApp, App, Walk-in, Google Reserve
- Depositos: Card hold (Stripe SetupIntent), pago completo, reembolsable, forfeit en no-show
- Waitlist con notificacion automatica
- Pagina de booking publica embeddable (sin autenticacion)
- Gestion de cancelacion con secret link
- Clases y sesiones grupales con capacidad limitada
- Vista de calendario y configuracion por venue

---

### 4.10 Analytics y Reportes

**Dashboards:**

- Home Dashboard: metricas clave con rango de fechas
- Command Center (multi-sucursal): resumen, actividad, insights, top sellers, breakdown por categoria
- Organization Dashboard: anomalias, managers, staff online, zones, goals, revenue trends, venue benchmarks
- Executive Analytics: insights cross-venue
- Store Analysis: overview, venues, stock, anomalias, closing report

**Reportes:**

- Sales Summary (resumen de ventas)
- Sales by Item (ventas por producto)
- Pay Later Aging (cuentas por cobrar)
- Payment Analytics (profit metrics, time series, provider comparison, export)
- Closing Report (reporte de cierre diario)
- Proximamente: Sales by Category, Payment Methods, Taxes, Voids, Modifiers

---

### 4.11 Sistema de Comisiones

- Configuraciones por organizacion o venue
- Commission overrides (excepciones por staff)
- Comisiones escalonadas (tiered): por monto, cantidad, periodo
- Milestones con bonos (porcentaje, monto fijo, producto gratis, dia libre)
- Achievement tracking
- Calculo automatico con resumenes por periodo
- Payouts y Clawbacks (reversos por devoluciones, no-shows)

---

### 4.12 Notificaciones Multi-Canal (30+ tipos)

**Canales activos:**

- In-App (dashboard)
- Email (via Resend con tracking: sent, delivered, opened, clicked, bounced)
- WhatsApp Business (via Meta Cloud API): recibos, confirmaciones, recordatorios, status updates
- Push Notifications (via FCM)
- Proximamente: SMS, Webhooks

**Tipos incluyen:** Nueva orden, pago recibido/fallido/reembolso, review negativa, turno terminado, POS desconectado, inventario bajo, KYC
status changes, trial terminando, resumen diario de ventas, etc.

---

### 4.13 Training y Capacitacion

- Modulos con pasos visuales (imagenes, videos)
- Quizzes: Multiple choice, True/False, Multi-select
- Categorias: Ventas, Inventario, Pagos, Atencion al Cliente, General
- Dificultades: Basico, Intermedio
- Threshold de aprobacion y intentos maximos configurables
- Progress tracking por staff
- Scoping: Global, por organizacion, o por venues especificos

---

### 4.14 Asistente de IA

- Text-to-SQL: preguntas en lenguaje natural sobre el negocio
- Schema context generator (entiende la estructura de la BD)
- Intent registry (routing inteligente de preguntas)
- Industry-specific templates (restaurantes, retail)
- Feedback system: correcto, incorrecto, parcialmente correcto
- Token budget management por venue + compra de tokens adicionales

---

### 4.15 Reviews y Reputacion Online

**Fuentes:** Avoqado (internas), Google, TripAdvisor, Facebook, Yelp, TPV (directas desde terminal)

- Google Business Profile Integration (OAuth, sync de reviews)
- Gestion de respuestas a reviews
- Sync automatico de reviews externas
- Alertas de reviews negativas (notificacion automatica)

---

### 4.16 Marketing

- Email templates personalizables
- Marketing campaigns: creacion, envio, cancelacion
- Campaign delivery tracking por destinatario
- TPV Messaging: enviar mensajes a terminales (broadcast/targeted)
  - Tipos: informativo, alerta, promocional, training, compliance, sistema
  - Prioridades: low, normal, high, urgent
  - Targets: all, specific, role-based, zone, venue
  - Respuestas desde TPV (texto libre, escala, opcion multiple, confirmacion)
- Push notification campaigns via FCM

---

### 4.17 E-commerce y SDK de Pagos

- Merchant accounts para e-commerce (separados del POS)
- Multi-channel: Web Principal, App Movil, Uber Eats, etc.
- API keys: Public key + Secret key (SHA-256 hash)
- Sandbox/Live modes independientes
- Checkout sessions (intent de pago temporal)
- Card tokenization segura (rate-limited: 10 req/min por IP)
- Webhook notifications configurables por merchant
- Multi-proveedor: Blumon Hosted Checkout, Stripe, Square-ready

---

### 4.18 Billing y Suscripciones

- Stripe integration para billing
- Trials de 30 dias
- Planes premium:
  - Inventario FIFO ($180-280 MXN/mes)
  - Reportes avanzados ($180-280 MXN/mes)
  - AI Assistant ($180-280 MXN/mes)
  - Online Ordering ($180-280 MXN/mes)
- Invoices: Draft, Pending, Paid, Overdue, Cancelled
- Fee types: Porcentaje, Fijo, Escalonado

---

### 4.19 Arquitectura Multi-Tenant

```
Organizacion
  └── Zonas Geograficas (CDMX, Zona Norte, Zona Sur)
       └── Venues (sucursales individuales)
            └── Staff (con roles por venue)
            └── Terminals (POS)
            └── Customers (por venue)
            └── Products, Orders, Payments...
```

**Herencia de configuracion:** Org → Venue (payment config, pricing, sales goals, attendance, commissions, trainings)

**White-Label:**

- Logo y colores personalizados por venue
- Rutas independientes (/wl/venues/:slug/\*)
- Dashboards de organizacion (/wl/organizations/:orgSlug/\*)
- Feature codes para control de acceso por modulo
- Presets: Telecom, Jewelry, Retail

---

### 4.20 KYC y Compliance (Mexico)

**Documentos requeridos:**

- RFC (constancia de situacion fiscal)
- INE/IFE (identificacion oficial)
- Acta Constitutiva (solo Persona Moral)
- Comprobante de Domicilio
- Caratula Bancaria (con CLABE visible)
- Poder Legal (solo Persona Moral)

**Flujo:** NOT_SUBMITTED → PENDING_REVIEW → IN_REVIEW → VERIFIED | REJECTED

**Compliance:** Ley mexicana de retencion de datos (venues de produccion NO se pueden borrar). Entity types: Persona Fisica y Persona Moral.

---

### 4.21 Superadmin (Control Plane)

Panel global para gestionar TODA la plataforma:

- Venues: ver todos, aprobar, suspender, activar
- KYC Review: revisar documentos, aprobar/rechazar
- Features y Modules: gestionar por venue u org
- Payment Providers y Merchant Accounts
- Cost Structures y Settlement Terms
- Venue Pricing y Organizations
- Staff Management global
- Payment Analytics (profit, time series, provider comparison)
- Revenue tracking y Profit Analytics
- Credit Assessment
- Marketing (templates, campaigns)
- Training (modulos, quizzes)
- App Updates OTA
- Push Notifications
- Webhooks monitoring
- Activity Log (auditoria global)
- Server Health
- Bulk Onboarding
- Growth metrics
- E-commerce Channels
- Master TOTP (2FA maestro)

---

### 4.22 Modulos Especializados

**PlayTelecom (Retail de Telecomunicaciones):**

- Command Center: dashboard global multi-sucursal en tiempo real
- Stock Serializado: tracking por IMEI/serial, registro masivo
- Promoters Audit: auditoria de fuerza de ventas, depositos, GPS
- Stores Analysis: analytics por tienda, comparativas, anomalias
- Manager Dashboard: vista para managers de zona con metas
- Supervisor Dashboard: cobertura operacional en tiempo real
- Sales Reports: reportes de ventas con evidencia (proof of sale)
- TPV Configuration: modulos, catalogo SIMs, reglas de evidencia
- Closing Report: reporte de cierre diario con export Excel
- Users Management: usuarios, zonas, permisos

**Jewelry (Joyerias):**

- Appraisals: sistema de avaluos con certificados y precio del oro
- Consignment: tracking de consignacion con comisiones y renovacion

---

### 4.23 Sistema de Demo

- **Live Demo** (publico): demo anonima en demo.dashboard.avoqado.io, auto-cleanup
- **Trial** (privado): 30 dias para usuarios registrados
- Generacion de datos demo
- Conversion de demo a produccion (KYC + datos reales)
- Estados: LIVE_DEMO → TRIAL → ONBOARDING → PENDING_ACTIVATION → ACTIVE

---

### 4.24 Portal de Clientes

- Registro de cuenta de cliente por venue
- Login de cliente (JWT independiente del staff)
- Portal con historial de ordenes, balances de credit packs, datos personales
- Actualizacion de perfil

---

### 4.25 Features Publicas (Sin Login)

1. Pagina de booking publica (/book/:venueSlug)
2. Gestion de reservacion (/book/:venueSlug/manage/:cancelSecret)
3. Viewer de recibos digitales (/receipts/public/:accessKey)
4. Review desde recibo (dejar review directamente desde recibo digital)
5. Credit Packs publicos (ver, consultar balance, comprar)
6. Payment Links publicos (resolver link, checkout, completar pago)
7. Info del venue (datos publicos para booking y landing pages)

---

## 5. Integraciones de Terceros (14 funcionales)

| Servicio                           | Uso                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------- |
| **Firebase Auth**                  | Autenticacion (email, Google, passkeys)                                   |
| **Firebase Storage**               | Almacenamiento de archivos (KYC docs, imagenes)                           |
| **Stripe**                         | Billing, suscripciones, deposits (SetupIntent)                            |
| **Blumon**                         | Procesamiento de pagos (hosted checkout), reconciliacion 4 capas          |
| **Menta**                          | Procesamiento de pagos (smart caching de terminal IDs)                    |
| **Clip**                           | Procesamiento de pagos (wallet)                                           |
| **B4Bit**                          | Pagos en criptomonedas (BTC, ETH, USDT) con HMAC-SHA256                   |
| **WhatsApp Business API**          | Recibos, confirmaciones, recordatorios, status updates                    |
| **Resend**                         | Email transaccional (tracking: sent, delivered, opened, clicked, bounced) |
| **Google Business Profile**        | Sync de reviews, OAuth                                                    |
| **Google Places / Maps**           | Autocompletado de direcciones, geocoding                                  |
| **FCM (Firebase Cloud Messaging)** | Push notifications                                                        |
| **Svix**                           | Verificacion de firmas de webhooks                                        |
| **Google / Unwired Labs**          | Geolocalizacion de terminales                                             |

**Integraciones POS:**

- SoftRestaurant (~40% implementado, event handlers + RabbitMQ)
- Planeadas: Square, Toast, Clover, Aloha, Micros, NCR

---

## 6. Feature Registry (31 features en el dashboard)

### 19 Avoqado Core Features

| Feature       | Descripcion                                                   |
| ------------- | ------------------------------------------------------------- |
| Dashboard     | Panel principal con metricas de ventas, ordenes y rendimiento |
| Ordenes       | Gestion de ordenes, historial y detalles de transacciones     |
| Pagos         | Historial de pagos, metodos y detalles de transacciones       |
| Menu          | Gestion de productos, categorias, modificadores y precios     |
| Inventario    | Control de stock, ingredientes, recetas y alertas             |
| Equipo        | Gestion del personal, roles, permisos y horarios              |
| Clientes      | Base de datos de clientes, historial de compras y contacto    |
| Terminales    | Gestion de terminales de punto de venta y dispositivos        |
| Balance       | Balance disponible, historial de depositos y retiros          |
| Promociones   | Descuentos, cupones, promociones especiales y ofertas         |
| Analitica     | Analisis avanzado de ventas, tendencias y metricas            |
| Turnos        | Control de turnos, apertura y cierre de caja                  |
| Comisiones    | Sistema de comisiones con configuracion, aprobaciones y pagos |
| Lealtad       | Sistema de puntos y recompensas para clientes frecuentes      |
| Resenas       | Gestion de resenas de clientes y Google Reviews               |
| Reportes      | Reportes de ventas, ingresos y analisis del negocio           |
| Reservaciones | Gestion de reservaciones, calendario, lista de espera         |
| Ligas de Pago | Ligas de pago para cobrar via WhatsApp, QR o link directo     |
| Ajustes       | Configuracion del venue, roles y facturacion                  |

### 10 PlayTelecom Features

Centro de Comando, Inventario Serializado, Auditoria de Promotores, Analisis de Tiendas, Dashboard Gerentes, Reporte de Ventas, Dashboard
Supervisor, Configuracion White Label, Reporte de Cierre, Gestion de Usuarios

### 2 Jewelry Features

Avaluos, Consignacion

---

## 7. Seguridad

- Firebase Authentication (email, Google OAuth, passkeys/WebAuthn)
- PIN-based login para TPV (rapido, por venue)
- Master TOTP para superadmin
- RBAC con 50+ permisos granulares
- Geofencing para terminales
- Lock/unlock remoto de terminales
- Rate limiting en endpoints sensibles
- IP whitelisting para webhooks (Blumon)
- HMAC-SHA256 signature verification (B4Bit)
- HTTP-only cookies (withCredentials)
- Auto-redirect en 401
- Activity logs (auditoria global inmutable)
- KYC verification obligatorio
- Compliance con leyes mexicanas de retencion de datos

---

## 8. Real-time (Socket.IO)

- Terminal health monitoring (heartbeat en vivo)
- Terminal logs streaming
- Notificaciones en tiempo real
- Comandos de TPV (envio y ACK)
- Actualizaciones de ordenes
- POS connection status

---

## 9. Localizacion

| Idioma       | Estado                                |
| ------------ | ------------------------------------- |
| Espanol (es) | Completo — idioma principal           |
| Ingles (en)  | Completo                              |
| Frances (fr) | Parcial (sidebar + areas principales) |

- Timezone configurable por venue (default: America/Mexico_City)
- Moneda configurable por venue (default: MXN)
- Pais configurable por venue (default: MX)

---

## 10. Ambientes y Deploy

| Ambiente   | Dashboard URL                | API URL             | Trigger          |
| ---------- | ---------------------------- | ------------------- | ---------------- |
| Demo       | demo.dashboard.avoqado.io    | demo.api.avoqado.io | Push a `develop` |
| Staging    | staging.dashboard.avoqado.io | Render staging      | Push a `develop` |
| Production | dashboard.avoqado.io         | api.avoqado.io      | Push a `main`    |

---

## 11. Numeros Clave (para landing page)

| Metrica                       | Cantidad       |
| ----------------------------- | -------------- |
| Modelos de base de datos      | 130+           |
| Endpoints API                 | 600+           |
| Archivos de servicio          | 74             |
| Tipos de negocio soportados   | 35+            |
| Roles de usuario              | 9              |
| Permisos granulares           | 50+            |
| Features en registry          | 31             |
| Guards de ruta                | 9 tipos        |
| Tipos de notificacion         | 30+            |
| Tipos de producto             | 7              |
| Procesadores de pago          | 6              |
| Plataformas                   | 11             |
| Integraciones terceros        | 14 funcionales |
| Idiomas                       | 3              |
| Features publicas (sin login) | 7              |

---

## 12. Diferenciadores Clave (messaging para landing)

1. **Todo-en-uno real** — No es solo POS o solo pagos. Es POS + pagos + inventario + CRM + analytics + reservaciones + e-commerce +
   comisiones + training + AI + white-label en un solo lugar.

2. **Multi-plataforma nativo** — Dashboard web, app Android POS, app iOS, modo kiosko, SDK de checkout, booking publico, recibos digitales —
   todo conectado en tiempo real.

3. **Disenado para Mexico y LATAM** — KYC mexicano (RFC, INE, CLABE), timezone por venue (America/Mexico_City), moneda MXN, compliance con
   leyes de retencion de datos, soporte Persona Fisica y Moral.

4. **White-label listo** — Organizaciones pueden tener su propia marca, colores, features seleccionados. Presets para Telecom, Joyeria,
   Retail.

5. **Crypto-ready** — Acepta BTC, ETH, USDT via B4Bit con verificacion criptografica.

6. **AI integrado** — Asistente de IA con Text-to-SQL para hacer preguntas sobre tu negocio en lenguaje natural.

7. **Gestion remota de terminales** — Comandos remotos, OTA updates, geofencing, comandos programados, monitoreo de salud en tiempo real.

8. **Multi-tenant real** — Organizacion → Zonas → Venues → Staff. Herencia de configuracion. Un staff puede tener diferentes roles en
   diferentes venues.

9. **Verticales especializados** — Modulos especificos para Telecomunicaciones (PlayTelecom) y Joyerias. No es generico — tiene features
   profundos por industria.

10. **Trial sin friccion** — Live demo anonima + trial de 30 dias + conversion suave a produccion.

---

## 13. Servicios del Backend (74 archivos de servicio)

Los servicios cubren: access control, analytics, auth, available balance, cash closeout, chat, class sessions, command center, commissions,
cost management, coupons, credit offers, credit packs, crypto config, customers, dashboard progressive loading, discounts, e-commerce
merchants, features, inventory, item categories, labels, live demo, loyalty, menus, menu import, notifications, onboarding, orders,
organizations, organization dashboard, org item categories, payment links, payment providers, permission sets, promoters, public booking,
purchase orders, reservations, review responses, role config, role permissions, sale verification, serialized inventory, settlement
configuration, settlement incidents, setup, stock dashboard, stores analysis, superadmin (activity log, marketing, modules, organizations,
staff, terminals, training, general), suppliers, team, TPV (messages, settings, general), webhooks.

---

## 14. Flujo del Usuario (Onboarding)

1. **Registro** — Email + password o Google OAuth
2. **Verificacion de email** — Confirmacion obligatoria
3. **Setup Wizard** — Datos basicos del negocio (nombre, tipo, direccion via Google Places autocomplete)
4. **KYC** — Subida de documentos mexicanos (RFC, INE, etc.)
5. **Revision** — Superadmin revisa y aprueba/rechaza
6. **Activacion** — Venue activo, listo para operar
7. **Alternativa: Demo** — Probar la plataforma sin KYC, con datos de ejemplo

---

_Este documento contiene toda la informacion extraida del codebase de produccion de Avoqado necesaria para disenar un landing page completo
y preciso._
