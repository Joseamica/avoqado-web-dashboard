// ==========================================
// ENUMS (Deben coincidir con tu schema Prisma)
// ==========================================

export enum BusinessType {
  RESTAURANT = 'RESTAURANT',
  RETAIL = 'RETAIL',
  HOTEL = 'HOTEL',
  FITNESS = 'FITNESS',
  SPA = 'SPA',
  OTHER = 'OTHER',
}

export enum VenueType {
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  RETAIL_STORE = 'RETAIL_STORE',
  HOTEL_RESTAURANT = 'HOTEL_RESTAURANT',
  FITNESS_STUDIO = 'FITNESS_STUDIO',
  SPA = 'SPA',
  OTHER = 'OTHER',
}

export enum PosType {
  SOFTRESTAURANT = 'SOFTRESTAURANT',
  SQUARE = 'SQUARE',
  TOAST = 'TOAST',
  CLOVER = 'CLOVER',
  ALOHA = 'ALOHA',
  MICROS = 'MICROS',
  NCR = 'NCR',
  CUSTOM = 'CUSTOM',
  NONE = 'NONE',
}

export enum PosStatus {
  NOT_INTEGRATED = 'NOT_INTEGRATED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

export enum FeeType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  TIERED = 'TIERED',
}

export enum StaffRole {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  CASHIER = 'CASHIER',
  KITCHEN = 'KITCHEN',
  HOST = 'HOST',
  VIEWER = 'VIEWER',
}

export enum ProductType {
  FOOD = 'FOOD',
  BEVERAGE = 'BEVERAGE',
  ALCOHOL = 'ALCOHOL',
  RETAIL = 'RETAIL',
  SERVICE = 'SERVICE',
  OTHER = 'OTHER',
}

export enum MenuType {
  REGULAR = 'REGULAR',
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SEASONAL = 'SEASONAL',
  CATERING = 'CATERING',
  DRINKS = 'DRINKS',
  KIDS = 'KIDS',
}

export enum MovementType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ADJUSTMENT = 'ADJUSTMENT',
  LOSS = 'LOSS',
  TRANSFER = 'TRANSFER',
  COUNT = 'COUNT',
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEOUT = 'TAKEOUT',
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export enum OrderSource {
  TPV = 'TPV',
  QR = 'QR',
  WEB = 'WEB',
  APP = 'APP',
  PHONE = 'PHONE',
  POS = 'POS',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum KitchenStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OTHER = 'OTHER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum TransactionType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SETTLED = 'SETTLED',
  FAILED = 'FAILED',
}

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export enum FeatureCategory {
  OPERATIONS = 'OPERATIONS',
  PAYMENTS = 'PAYMENTS',
  MARKETING = 'MARKETING',
  ANALYTICS = 'ANALYTICS',
  INTEGRATIONS = 'INTEGRATIONS',
}

export enum ChargeType {
  TRANSACTION_FEE = 'TRANSACTION_FEE',
  FEATURE_FEE = 'FEATURE_FEE',
  SETUP_FEE = 'SETUP_FEE',
  OVERAGE_FEE = 'OVERAGE_FEE',
  OTHER = 'OTHER',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ReviewSource {
  AVOQADO = 'AVOQADO',
  GOOGLE = 'GOOGLE',
  TRIPADVISOR = 'TRIPADVISOR',
  FACEBOOK = 'FACEBOOK',
  YELP = 'YELP',
  TPV = 'TPV',
}

export enum TerminalType {
  TPV_ANDROID = 'TPV_ANDROID',
  TPV_IOS = 'TPV_IOS',
  PRINTER_RECEIPT = 'PRINTER_RECEIPT',
  PRINTER_KITCHEN = 'PRINTER_KITCHEN',
  KDS = 'KDS',
}

export enum TerminalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

export enum InvitationType {
  ORGANIZATION_ADMIN = 'ORGANIZATION_ADMIN',
  VENUE_STAFF = 'VENUE_STAFF',
  VENUE_ADMIN = 'VENUE_ADMIN',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum AuthProvider {
  EMAIL = 'EMAIL',
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  APPLE = 'APPLE',
}

export enum ReceiptStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  VIEWED = 'VIEWED',
  ERROR = 'ERROR',
}

// OBSOLETO: Esta definición se mantiene temporalmente para compatibilidad
// Usar la definición completa de Order más abajo
export interface OrderLegacy {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  source: OrderSource
  subtotal: number
  taxAmount: number
  tipAmount: number
  total: number
  customerName: string | null
  createdAt: string
  updatedAt: string
  createdBy?: Staff | null
  servedBy?: Staff | null
  table?: TableSimple | null
  payments?: Payment[]
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  orderId: string
  order?: Order
  productId: string
  product: Product
  quantity: number
  unitPrice: number
  total: number
  notes: string | null
  modifiers?: OrderItemModifier[]
  kitchenStatus: KitchenStatus
  prepTime?: number | null
  externalId: string | null
  createdAt: string
}

// OBSOLETO: Esta definición se mantiene temporalmente para compatibilidad
export interface PaymentLegacy {
  id: string
  amount: number
  tipAmount: number
  method: PaymentMethod
  status: PaymentStatus
  createdAt: string
  processedBy?: Staff | null
  order?: Order | null
}

// OBSOLETO: Esta definición se mantiene temporalmente para compatibilidad
export interface TableLegacy {
  id: string
  number: string
  section: string | null
  capacity: number
}

// ==========================================
// TIPOS DE MODELOS PRINCIPALES (NUEVOS Y ACTUALIZADOS)
// ==========================================

// Organización (tenant principal del sistema multi-tenant)
export interface Organization {
  id: string
  name: string
  email: string
  phone: string
  taxId: string | null
  type: BusinessType

  // Billing
  billingEmail: string | null
  billingAddress: any | null // Json type

  // Relations
  venues?: Venue[]
  staff?: Staff[]
  invitations?: Invitation[]
  invoices?: Invoice[]

  createdAt: string
  updatedAt: string
}

// Venue (establecimiento)
export interface Venue {
  id: string
  organizationId: string
  organization?: Organization

  // Basic info
  name: string
  slug: string
  type: VenueType
  timezone: string
  currency: string

  // Location
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  latitude: number | null
  longitude: number | null

  // Contact
  phone: string
  email: string
  website: string | null

  // Branding
  logo: string | null
  primaryColor: string | null
  secondaryColor: string | null

  // Status
  active: boolean
  operationalSince: string | null

  // POS Integration
  posType: PosType | null
  posConfig: any | null // Json type
  posStatus: PosStatus

  // Avoqado Fees
  feeType: FeeType
  feeValue: number
  feeScheduleId: string | null
  feeSchedule?: FeeSchedule | null

  // Features & Settings
  features: VenueFeature[]
  settings?: VenueSettings | null

  // Otros campos que necesites...
  role?: StaffRole // Campo adicional para el frontend

  createdAt: string
  updatedAt: string
}

// Configuración de un Venue
export interface VenueSettings {
  id: string
  venueId: string
  venue?: Venue

  // Operations
  autoCloseShifts: boolean
  shiftDuration: number
  requirePinLogin: boolean

  // Reviews
  autoReplyReviews: boolean
  notifyBadReviews: boolean
  badReviewThreshold: number

  // Inventory
  trackInventory: boolean
  lowStockAlert: boolean
  lowStockThreshold: number

  // Customer features
  allowReservations: boolean
  allowTakeout: boolean
  allowDelivery: boolean

  // Payment
  acceptCash: boolean
  acceptCard: boolean
  acceptDigitalWallet: boolean
  tipSuggestions: any | null // Json type

  updatedAt: string
}

// Modelo de Feature (característica/funcionalidad)
export interface Feature {
  id: string
  code: string
  name: string
  description: string | null

  category: FeatureCategory
  monthlyPrice: number

  active: boolean

  venues?: VenueFeature[]
}

// Relación entre Venue y Feature
export interface VenueFeature {
  id: string
  venueId: string
  venue?: Venue
  featureId: string
  feature: Feature

  active: boolean
  monthlyPrice: number

  startDate: string
  endDate: string | null
}

// ANTERIOR: No existía o era parcial
// NUEVO: Representa el modelo Staff
export interface Staff {
  id: string
  organizationId: string
  organization?: Organization

  // Authentication
  email: string
  password?: string // No se incluye en respuestas API
  pin?: string // No se incluye en respuestas API

  // Profile
  firstName: string
  lastName: string
  phone: string | null
  employeeCode: string | null
  photoUrl: string | null

  // Status
  active: boolean
  emailVerified: boolean

  // Relations
  venues?: StaffVenue[]

  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

// Relación entre Staff y Venue
export interface StaffVenue {
  id: string
  staffId: string
  staff?: Staff
  posStaffId?: string | null
  venueId: string
  venue?: Venue

  role: StaffRole
  permissions: any | null // Json type

  // Performance tracking
  totalSales: number
  totalTips: number
  averageRating: number
  totalOrders: number

  active: boolean
  startDate: string
  endDate: string | null
}

// Invitación para unirse al sistema
export interface Invitation {
  id: string
  email: string
  role: StaffRole

  type: InvitationType

  // Organization (siempre requerida)
  organizationId: string
  organization?: Organization

  // Venue (opcional)
  venueId: string | null
  venue?: Venue | null

  // Token y seguridad
  token: string
  expiresAt: string

  // Estado
  status: InvitationStatus
  acceptedAt: string | null
  declinedAt: string | null

  // Metadata
  message: string | null
  permissions: any | null // Json type

  invitedById: string
  invitedBy?: Staff
  acceptedById: string | null

  attemptCount: number
  lastAttemptAt: string | null

  createdAt: string
  updatedAt: string
}

// ANTERIOR: AvoqadoProduct
// NUEVO: Modelo Product, con campos adicionales
export interface Product {
  id: string
  venueId: string
  venue?: Venue

  // Basic info
  sku: string
  name: string
  description: string | null

  // Category
  categoryId: string
  category?: MenuCategory

  // Type para reportes/analytics
  type: ProductType

  // Pricing
  price: number
  cost: number | null
  taxRate: number

  // Display
  imageUrl: string | null
  displayOrder: number
  featured: boolean

  // Dietary info
  tags: string[]
  allergens: string[]
  calories: number | null

  // Preparation
  prepTime: number | null
  cookingNotes: string | null

  // Inventory tracking
  trackInventory: boolean
  unit: string | null

  // Status
  active: boolean
  availableFrom: string | null
  availableUntil: string | null

  // POS Integration
  externalId: string | null
  externalData: any | null // Json type
  fromPOS: boolean
  syncStatus: SyncStatus
  lastSyncAt: string | null

  // Relations
  inventory?: Inventory | null
  modifierGroups?: ProductModifierGroup[]

  createdAt: string
  updatedAt: string
}

// ANTERIOR: Category
// NUEVO: Modelo MenuCategory, con jerarquía
export interface MenuCategory {
  id: string
  venueId: string
  venue?: Venue

  // Basic info
  name: string
  description: string | null
  slug: string

  // Display
  displayOrder: number
  imageUrl: string | null
  color: string | null
  icon: string | null

  // Hierarchy
  parentId: string | null
  parent?: MenuCategory | null
  children?: MenuCategory[]

  // Scheduling
  active: boolean
  availableFrom: string | null
  availableUntil: string | null
  availableDays: string[]

  // Relations
  products?: Product[]
  menus?: MenuCategoryAssignment[]

  createdAt: string
  updatedAt: string
}

// ANTERIOR: AvoqadoMenu
// NUEVO: Modelo Menu con más campos
export interface Menu {
  id: string
  venueId: string
  venue?: Venue

  // Basic info
  name: string
  description: string | null
  type: MenuType

  // Display
  displayOrder: number
  isDefault: boolean

  // Scheduling
  active: boolean
  startDate: string | null
  endDate: string | null
  availableFrom: string | null
  availableUntil: string | null
  availableDays: string[]

  // Relations
  categories?: MenuCategoryAssignment[]

  createdAt: string
  updatedAt: string
}

export interface MenuCategoryAssignment {
  id: string
  menuId: string
  menu?: Menu
  categoryId: string
  category?: MenuCategory

  displayOrder: number
}

// Modelo Order completo según el schema Prisma
export interface Order {
  id: string
  venueId: string
  venue?: Venue
  tableId: string | null
  table?: TableSimple | null
  staffId: string | null
  staff?: Staff | null
  servedById: string | null
  servedBy?: Staff | null
  shiftId: string | null
  shift?: Shift | null
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  source: OrderSource
  type: OrderType
  subtotal: number
  taxAmount: number
  tipAmount: number
  total: number
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerCount: number | null
  notes: string | null
  estimatedReadyTime: string | null
  externalId: string | null
  externalData: any | null
  fromPOS: boolean
  syncStatus: SyncStatus
  lastSyncAt: string | null
  items?: OrderItem[]
  payments?: Payment[]
  createdBy?: Staff | null
  createdAt: string
  updatedAt: string
}

// Modelo Payment completo según el schema Prisma
export interface Payment {
  id: string
  venueId: string
  venue?: Venue
  orderId: string | null
  order?: Order | null
  shiftId: string | null
  shift?: Shift | null
  staffId: string | null
  staff?: Staff | null

  // Amounts
  amount: number
  tipAmount: number
  total: number

  // Payment details
  method: PaymentMethod
  status: PaymentStatus
  processorName: string | null
  processorPaymentId: string | null
  processorData: any | null

  // Receipt
  receiptEmailSent: boolean
  receiptPhoneSent: boolean
  receiptEmailStatus: ReceiptStatus | null
  receiptPhoneStatus: ReceiptStatus | null

  transactions?: VenueTransaction[]

  createdAt: string
  updatedAt: string

  // Campos adicionales para compatibilidad
  processedBy?: Staff | null
  cardBrand?: string
  last4?: string
}

// Versión simplificada de Terminal para compatibilidad
export interface TerminalSimple {
  id: string
  name: string
  serialNumber: string
  type: TerminalType
  status: TerminalStatus
  venueId: string
}

// Versión simplificada de Table para compatibilidad
export interface TableSimple {
  id: string
  number: string
  section: string | null
  capacity: number
}

export interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  total: number
  notes: string | null
  product: Product // El producto asociado a este item
}

// ==========================================
// INTERFACES ADICIONALES PARA MODELOS DEL SCHEMA
// ==========================================

// Sistema de inventario
export interface Inventory {
  id: string
  productId: string
  product?: Product
  venueId: string
  venue?: Venue
  currentStock: number
  reservedStock: number
  minimumStock: number
  maximumStock: number | null

  lastRestockedAt: string | null
  lastCountedAt: string | null

  movements?: InventoryMovement[]

  updatedAt: string
}

export interface InventoryMovement {
  id: string
  inventoryId: string
  inventory?: Inventory

  type: MovementType
  quantity: number
  previousStock: number
  newStock: number

  reason: string | null
  reference: string | null

  createdBy: string | null
  createdAt: string
}

// Sistema de modificadores
export interface ModifierGroup {
  id: string
  venueId: string
  venue?: Venue

  name: string
  description: string | null

  required: boolean
  allowMultiple: boolean
  minSelections: number
  maxSelections: number | null

  displayOrder: number
  active: boolean

  modifiers?: Modifier[]
  products?: ProductModifierGroup[]

  createdAt: string
  updatedAt: string
}

export interface Modifier {
  id: string
  groupId: string
  group?: ModifierGroup

  name: string
  price: number

  active: boolean

  orderItems?: OrderItemModifier[]
}

export interface ProductModifierGroup {
  id: string
  productId: string
  product?: Product
  groupId: string
  group?: ModifierGroup

  displayOrder: number
}

export interface OrderItemModifier {
  id: string
  orderItemId: string
  orderItem?: OrderItem
  modifierId: string
  modifier?: Modifier

  quantity: number
  price: number
}

// Operaciones
export interface Table {
  id: string
  venueId: string
  venue?: Venue

  number: string
  section: string | null
  capacity: number
  qrCode: string

  active: boolean

  orders?: Order[]
}

export interface Shift {
  id: string
  venueId: string
  venue?: Venue
  staffId: string
  staff?: Staff

  startTime: string
  endTime: string | null

  // Cash management
  startingCash: number
  endingCash: number | null
  cashDifference: number | null

  // Summary
  totalSales: number
  totalTips: number
  totalOrders: number

  status: ShiftStatus
  notes: string | null

  orders?: Order[]
  payments?: Payment[]

  createdAt: string
  updatedAt: string
}

// Billing y fees
export interface FeeSchedule {
  id: string
  name: string
  description: string | null

  tiers?: FeeTier[]
  venues?: Venue[]

  active: boolean
}

export interface FeeTier {
  id: string
  scheduleId: string
  schedule?: FeeSchedule

  minVolume: number
  maxVolume: number | null
  percentage: number
}

export interface Invoice {
  id: string
  organizationId: string
  organization?: Organization

  invoiceNumber: string
  periodStart: string
  periodEnd: string
  dueDate: string

  // Amounts
  subtotal: number
  taxAmount: number
  total: number

  status: InvoiceStatus
  paidAt: string | null

  items?: InvoiceItem[]

  createdAt: string
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  invoice?: Invoice

  type: ChargeType
  description: string
  venueId: string | null

  quantity: number
  unitPrice: number
  amount: number
}

// Payments & Transactions
export interface VenueTransaction {
  id: string
  venueId: string
  venue?: Venue
  paymentId: string
  payment?: Payment

  type: TransactionType

  // Amounts
  grossAmount: number
  feeAmount: number
  netAmount: number

  // Settlement
  status: SettlementStatus
  settledAt: string | null
  settlementId: string | null

  createdAt: string
}

export interface Review {
  id: string
  venueId: string
  venue?: Venue

  // Rating
  overallRating: number
  foodRating: number | null
  serviceRating: number | null
  ambienceRating: number | null

  comment: string | null

  // Customer info
  customerName: string | null
  customerEmail: string | null

  // Source
  source: ReviewSource
  externalId: string | null

  terminalId: string | null
  terminal?: Terminal | null

  paymentId: string | null
  payment?: Payment | null

  servedById: string | null
  servedBy?: Staff | null

  // Response
  responseText: string | null
  respondedAt: string | null
  responseAutomated: boolean

  createdAt: string
}

// Terminal completo según schema Prisma
export interface Terminal {
  id: string
  venueId: string
  venue?: Venue

  serialNumber: string
  name: string
  type: TerminalType

  // Status
  status: TerminalStatus
  lastHeartbeat: string | null

  // Configuration
  config: any | null

  reviews?: Review[]

  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: string
  staffId: string | null
  staff?: Staff | null
  venueId: string

  action: string
  entity: string | null
  entityId: string | null

  data: any | null
  ipAddress: string | null
  userAgent: string | null

  createdAt: string
}

export interface Customer {
  id: string
  email: string | null
  phone: string | null

  firstName: string | null
  lastName: string | null
  birthDate: string | null
  gender: string | null

  // Auth
  password: string | null
  provider: AuthProvider
  providerId: string | null

  // Preferences
  language: string
  marketingConsent: boolean

  active: boolean

  createdAt: string
  updatedAt: string
}

// ==========================================
// TIPOS DE SESIÓN / CONTEXTO (Datos "aplanados" por el backend)
// ==========================================

// Representa la información del usuario logueado (transformación del Staff para el frontend)
export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  emailVerified: boolean
  photoUrl: string | null
  organizationId: string
  // El backend debe transformar StaffVenue en esto para mantener la consistencia
  venues: SessionVenue[]
  // El rol más alto que tiene el usuario en todas sus asignaciones
  role: StaffRole
}

// Representa un Venue simplificado para el contexto de sesión
export interface SessionVenue {
  id: string
  name: string
  slug: string
  logo: string | null
  address: string
  city: string
  timezone: string
  currency: string
  // El rol que el usuario logueado tiene EN ESTE venue específico
  role: StaffRole
  // Las features disponibles en este venue (estructura compatible con frontend actual)
  features: Array<{
    feature: {
      id: string
      code: string
      name: string
    }
    active: boolean
  }>
}

// ==========================================
// TEAM MANAGEMENT TYPES
// ==========================================

export interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: StaffRole
  active: boolean
  startDate: string
  endDate: string | null
  pin: string | null
  totalSales: number
  totalTips: number
  totalOrders: number
  averageRating: number
}

export interface TeamMemberDetails extends TeamMember {
  staffId: string
  venue: {
    id: string
    name: string
    organization: {
      name: string
    }
  }
}

export interface TeamInvitation {
  id: string
  email: string
  role: StaffRole
  status: InvitationStatus
  expiresAt: string
  createdAt: string
  message?: string
  invitedBy: {
    name: string
  }
}

export interface InviteTeamMemberRequest {
  email: string
  firstName: string
  lastName: string
  role: StaffRole
  message?: string
}

export interface UpdateTeamMemberRequest {
  role?: StaffRole
  active?: boolean
  pin?: string | null
}

// ==========================================
// TIPOS COMPATIBLES CON CÓDIGO FRONTEND ACTUAL
// Estos tipos están siendo reemplazados gradualmente por las versiones
// completas del schema Prisma arriba. Mantener hasta completar migración.
// ==========================================

// Los siguientes tipos OBSOLETOS han sido reemplazados por versiones Legacy arriba:
// - OrderLegacy (reemplaza Order antiguo)
// - PaymentLegacy (reemplaza Payment antiguo)
// - TableLegacy (reemplaza Table antiguo)
// - TerminalSimple (reemplaza Terminal/TPV antiguo)

// Las siguientes interfaces se han eliminado totalmente y sus reemplazos son:
// - Bill -> Order
// - Tip -> Payment.tipAmount
// - AvoqadoMenu -> Menu
// - AvoqadoProduct -> Product
// - Category -> MenuCategory
// - Tpv -> Terminal

// OBSOLETO: Reemplazado por `User` o `Staff[]`.
// export interface Users { ... }

// TODO: Migrar componentes que usen estos tipos legados.

// ==========================================
// MENU SYSTEM DTOs (Data Transfer Objects)
// ==========================================

// DTOs para operaciones de menús
export interface CreateMenuDto {
  name: string
  description?: string | null
  type: MenuType
  displayOrder?: number
  active?: boolean
  startDate?: string | null
  endDate?: string | null
  availableFrom?: string | null
  availableUntil?: string | null
  availableDays?: string[]
}

export interface UpdateMenuDto {
  name?: string
  description?: string | null
  type?: MenuType
  displayOrder?: number
  active?: boolean
  startDate?: string | null
  endDate?: string | null
  availableFrom?: string | null
  availableUntil?: string | null
  availableDays?: string[]
}

export interface CloneMenuDto {
  name: string
  copyCategories?: boolean
  copyProducts?: boolean
  copyModifiers?: boolean
}

// DTOs para operaciones de categorías de menú
export interface CreateMenuCategoryDto {
  name: string
  description?: string | null
  slug?: string
  displayOrder?: number
  imageUrl?: string | null
  color?: string | null
  icon?: string | null
  parentId?: string | null
  active?: boolean
  availableFrom?: string | null
  availableUntil?: string | null
  availableDays?: string[]
}

export interface UpdateMenuCategoryDto {
  name?: string
  description?: string | null
  slug?: string
  displayOrder?: number
  imageUrl?: string | null
  color?: string | null
  icon?: string | null
  parentId?: string | null
  active?: boolean
  availableFrom?: string | null
  availableUntil?: string | null
  availableDays?: string[]
}

// OBSOLETO: Reemplazado por `ModifierGroup` y el nuevo `Modifier`
// export interface ModifierGroup { ... }
