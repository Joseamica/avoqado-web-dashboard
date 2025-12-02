// ==========================================
// ENUMS (Deben coincidir con tu schema Prisma)
// ==========================================

export enum BusinessType {
  // === FOOD_SERVICE ===
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  BAKERY = 'BAKERY',
  FOOD_TRUCK = 'FOOD_TRUCK',
  FAST_FOOD = 'FAST_FOOD',
  CATERING = 'CATERING',
  CLOUD_KITCHEN = 'CLOUD_KITCHEN',

  // === RETAIL ===
  RETAIL_STORE = 'RETAIL_STORE',
  JEWELRY = 'JEWELRY',
  CLOTHING = 'CLOTHING',
  ELECTRONICS = 'ELECTRONICS',
  PHARMACY = 'PHARMACY',
  CONVENIENCE_STORE = 'CONVENIENCE_STORE',
  SUPERMARKET = 'SUPERMARKET',
  LIQUOR_STORE = 'LIQUOR_STORE',
  FURNITURE = 'FURNITURE',
  HARDWARE = 'HARDWARE',
  BOOKSTORE = 'BOOKSTORE',
  PET_STORE = 'PET_STORE',

  // === SERVICES ===
  SALON = 'SALON',
  SPA = 'SPA',
  FITNESS = 'FITNESS',
  CLINIC = 'CLINIC',
  VETERINARY = 'VETERINARY',
  AUTO_SERVICE = 'AUTO_SERVICE',
  LAUNDRY = 'LAUNDRY',
  REPAIR_SHOP = 'REPAIR_SHOP',

  // === HOSPITALITY ===
  HOTEL = 'HOTEL',
  HOSTEL = 'HOSTEL',
  RESORT = 'RESORT',

  // === ENTERTAINMENT ===
  CINEMA = 'CINEMA',
  ARCADE = 'ARCADE',
  EVENT_VENUE = 'EVENT_VENUE',
  NIGHTCLUB = 'NIGHTCLUB',
  BOWLING = 'BOWLING',

  OTHER = 'OTHER',
}

// Business Category - derived from BusinessType for UI adaptation
export type BusinessCategory = 'FOOD_SERVICE' | 'RETAIL' | 'SERVICES' | 'HOSPITALITY' | 'ENTERTAINMENT' | 'OTHER'

const CATEGORY_MAPPING: Record<BusinessType, BusinessCategory> = {
  [BusinessType.RESTAURANT]: 'FOOD_SERVICE',
  [BusinessType.BAR]: 'FOOD_SERVICE',
  [BusinessType.CAFE]: 'FOOD_SERVICE',
  [BusinessType.BAKERY]: 'FOOD_SERVICE',
  [BusinessType.FOOD_TRUCK]: 'FOOD_SERVICE',
  [BusinessType.FAST_FOOD]: 'FOOD_SERVICE',
  [BusinessType.CATERING]: 'FOOD_SERVICE',
  [BusinessType.CLOUD_KITCHEN]: 'FOOD_SERVICE',
  [BusinessType.RETAIL_STORE]: 'RETAIL',
  [BusinessType.JEWELRY]: 'RETAIL',
  [BusinessType.CLOTHING]: 'RETAIL',
  [BusinessType.ELECTRONICS]: 'RETAIL',
  [BusinessType.PHARMACY]: 'RETAIL',
  [BusinessType.CONVENIENCE_STORE]: 'RETAIL',
  [BusinessType.SUPERMARKET]: 'RETAIL',
  [BusinessType.LIQUOR_STORE]: 'RETAIL',
  [BusinessType.FURNITURE]: 'RETAIL',
  [BusinessType.HARDWARE]: 'RETAIL',
  [BusinessType.BOOKSTORE]: 'RETAIL',
  [BusinessType.PET_STORE]: 'RETAIL',
  [BusinessType.SALON]: 'SERVICES',
  [BusinessType.SPA]: 'SERVICES',
  [BusinessType.FITNESS]: 'SERVICES',
  [BusinessType.CLINIC]: 'SERVICES',
  [BusinessType.VETERINARY]: 'SERVICES',
  [BusinessType.AUTO_SERVICE]: 'SERVICES',
  [BusinessType.LAUNDRY]: 'SERVICES',
  [BusinessType.REPAIR_SHOP]: 'SERVICES',
  [BusinessType.HOTEL]: 'HOSPITALITY',
  [BusinessType.HOSTEL]: 'HOSPITALITY',
  [BusinessType.RESORT]: 'HOSPITALITY',
  [BusinessType.CINEMA]: 'ENTERTAINMENT',
  [BusinessType.ARCADE]: 'ENTERTAINMENT',
  [BusinessType.EVENT_VENUE]: 'ENTERTAINMENT',
  [BusinessType.NIGHTCLUB]: 'ENTERTAINMENT',
  [BusinessType.BOWLING]: 'ENTERTAINMENT',
  [BusinessType.OTHER]: 'OTHER',
}

export function getBusinessCategory(type: BusinessType): BusinessCategory {
  return CATEGORY_MAPPING[type] || 'OTHER'
}

// UI Terminology by category
export const CATEGORY_TERMINOLOGY: Record<
  BusinessCategory,
  { menu: string; item: string; order: string; table: string }
> = {
  FOOD_SERVICE: { menu: 'Menú', item: 'Platillo', order: 'Orden', table: 'Mesa' },
  RETAIL: { menu: 'Catálogo', item: 'Producto', order: 'Venta', table: 'Caja' },
  SERVICES: { menu: 'Servicios', item: 'Servicio', order: 'Cita', table: 'Estación' },
  HOSPITALITY: { menu: 'Servicios', item: 'Servicio', order: 'Reservación', table: 'Habitación' },
  ENTERTAINMENT: { menu: 'Eventos', item: 'Evento', order: 'Entrada', table: 'Sala' },
  OTHER: { menu: 'Catálogo', item: 'Item', order: 'Orden', table: 'Ubicación' },
}

export function getTerminology(type: BusinessType) {
  return CATEGORY_TERMINOLOGY[getBusinessCategory(type)]
}

export enum VenueType {
  // === FOOD_SERVICE ===
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  BAKERY = 'BAKERY',
  FOOD_TRUCK = 'FOOD_TRUCK',
  FAST_FOOD = 'FAST_FOOD',
  CATERING = 'CATERING',
  CLOUD_KITCHEN = 'CLOUD_KITCHEN',

  // === RETAIL ===
  RETAIL_STORE = 'RETAIL_STORE',
  JEWELRY = 'JEWELRY',
  CLOTHING = 'CLOTHING',
  ELECTRONICS = 'ELECTRONICS',
  PHARMACY = 'PHARMACY',
  CONVENIENCE_STORE = 'CONVENIENCE_STORE',
  SUPERMARKET = 'SUPERMARKET',
  LIQUOR_STORE = 'LIQUOR_STORE',
  FURNITURE = 'FURNITURE',
  HARDWARE = 'HARDWARE',
  BOOKSTORE = 'BOOKSTORE',
  PET_STORE = 'PET_STORE',

  // === SERVICES ===
  SALON = 'SALON',
  SPA = 'SPA',
  FITNESS = 'FITNESS',
  CLINIC = 'CLINIC',
  VETERINARY = 'VETERINARY',
  AUTO_SERVICE = 'AUTO_SERVICE',
  LAUNDRY = 'LAUNDRY',
  REPAIR_SHOP = 'REPAIR_SHOP',

  // === HOSPITALITY ===
  HOTEL = 'HOTEL',
  HOSTEL = 'HOSTEL',
  RESORT = 'RESORT',

  // === ENTERTAINMENT ===
  CINEMA = 'CINEMA',
  ARCADE = 'ARCADE',
  EVENT_VENUE = 'EVENT_VENUE',
  NIGHTCLUB = 'NIGHTCLUB',
  BOWLING = 'BOWLING',

  // === LEGACY ===
  HOTEL_RESTAURANT = 'HOTEL_RESTAURANT',
  FITNESS_STUDIO = 'FITNESS_STUDIO',

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

export enum ModifierInventoryMode {
  ADDITION = 'ADDITION',
  SUBSTITUTION = 'SUBSTITUTION',
}

export enum Unit {
  UNIT = 'UNIT',
  KILOGRAM = 'KILOGRAM',
  GRAM = 'GRAM',
  LITER = 'LITER',
  MILLILITER = 'MILLILITER',
  OUNCE = 'OUNCE',
  POUND = 'POUND',
  CUP = 'CUP',
  TABLESPOON = 'TABLESPOON',
  TEASPOON = 'TEASPOON',
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

  // Demo mode
  isOnboardingDemo?: boolean
  demoExpiresAt?: string | null

  // Tax Information (for converting from demo to real)
  rfc?: string | null // RFC (Tax ID) for Mexico
  legalName?: string | null // Legal business name
  fiscalRegime?: string | null // Fiscal regime code
  taxDocumentUrl?: string | null // URL to tax document
  idDocumentUrl?: string | null // URL to ID document
  actaDocumentUrl?: string | null // URL to Acta Constitutiva document

  // KYC Verification (for payment processing access control)
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null
  kycRejectionReason?: string | null

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
  badReviewAlertRoles: StaffRole[]

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

  // Stripe subscription fields
  stripeSubscriptionId?: string | null
  stripeSubscriptionItemId?: string | null
  stripePriceId?: string | null
  trialEndDate?: string | null
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
  inventoryMethod: 'QUANTITY' | 'RECIPE' | null
  unit: string | null
  availableQuantity?: number | null // Toast POS style unified field for both QUANTITY and RECIPE
  lowStockThreshold?: number | null // Alert threshold for low stock warnings (configurable per product)

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

  // Merchant account tracking
  merchantAccountId: string | null
  merchantAccount?: {
    id: string
    displayName: string | null
    externalMerchantId: string
    bankName: string | null
    clabeNumber: string | null
    accountHolder: string | null
    blumonSerialNumber: string | null
    blumonPosId: string | null
    provider: {
      id: string
      code: string
      name: string
    }
  } | null

  // Amounts
  amount: number
  tipAmount: number
  total: number

  // Payment details
  method: PaymentMethod
  status: PaymentStatus
  source: string // De dónde se procesó el pago: AVOQADO_TPV, DASHBOARD_TEST, QR, WEB, APP, POS
  processorName: string | null
  processorPaymentId: string | null
  posRawData: {
    staffId?: string
    splitType?: string
    paidProductsId?: string[]
    [key: string]: any
  } | null
  processorData: {
    currency?: string
    cardBrand?: string
    typeOfCard?: string
    isInternational?: boolean
    bank?: string
    [key: string]: any // Otros campos del procesador
  } | null

  // Receipt
  receiptEmailSent: boolean
  receiptPhoneSent: boolean
  receiptEmailStatus: ReceiptStatus | null
  receiptPhoneStatus: ReceiptStatus | null

  transactions?: VenueTransaction[]

  // Transaction cost/profit (for SUPERADMIN)
  transactionCost?: {
    id: string
    transactionType: string // DEBIT, CREDIT, AMEX, INTERNATIONAL
    amount: number
    providerRate: number // Rate charged by provider
    providerCostAmount: number // What Avoqado pays to provider
    providerFixedFee: number
    venueRate: number // Rate Avoqado charges to venue
    venueChargeAmount: number // What Avoqado charges to venue
    venueFixedFee: number
    grossProfit: number // venueCharge - providerCost (Avoqado's profit)
    profitMargin: number // grossProfit / venueCharge
  } | null

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

  // Inventory tracking fields (Toast/Square pattern)
  rawMaterialId?: string | null
  rawMaterial?: {
    id: string
    name: string
    sku: string
    unit: string
    currentStock: number
    costPerUnit: number
  } | null
  quantityPerUnit?: number | null // Amount of raw material per modifier unit
  unit?: Unit | string | null // Unit of measurement
  inventoryMode?: ModifierInventoryMode | null // ADDITION or SUBSTITUTION

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
  phone: string | null
  organizationId: string
  // El backend debe transformar StaffVenue en esto para mantener la consistencia
  venues: SessionVenue[]
  // El rol más alto que tiene el usuario en todas sus asignaciones
  role: StaffRole
  createdAt: string
  lastLogin: string | null
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
  // Whether this venue is in demo mode
  isOnboardingDemo?: boolean
  // Custom permissions for this user in this venue (from StaffVenue.permissions)
  permissions?: string[] | null
  // KYC Verification (for payment processing access control)
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null
  kycRejectionReason?: string | null
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

// ==========================================
// ROLE CONFIG TYPES (Custom Role Display Names)
// ==========================================

/**
 * Role configuration for custom display names per venue.
 * Allows venues to customize how roles are displayed in the UI
 * without changing the underlying StaffRole enum.
 */
export interface RoleConfig {
  role: StaffRole
  displayName: string
  description: string | null
  icon: string | null
  color: string | null
  isActive: boolean
  sortOrder: number
}

/**
 * Input type for updating role configurations.
 * Only role and displayName are required.
 */
export interface RoleConfigInput {
  role: StaffRole
  displayName: string
  description?: string | null
  icon?: string | null
  color?: string | null
  isActive?: boolean
  sortOrder?: number
}

/**
 * Response from the role-config API endpoints
 */
export interface RoleConfigResponse {
  configs: RoleConfig[]
}

/**
 * Default display names for roles (Spanish)
 * Used as fallback when no custom config exists
 */
export const DEFAULT_ROLE_DISPLAY_NAMES: Record<StaffRole, string> = {
  [StaffRole.SUPERADMIN]: 'Super Administrador',
  [StaffRole.OWNER]: 'Propietario',
  [StaffRole.ADMIN]: 'Administrador',
  [StaffRole.MANAGER]: 'Gerente',
  [StaffRole.CASHIER]: 'Cajero',
  [StaffRole.WAITER]: 'Mesero',
  [StaffRole.KITCHEN]: 'Cocina',
  [StaffRole.HOST]: 'Host',
  [StaffRole.VIEWER]: 'Observador',
}
