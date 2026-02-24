// src/routes/lazyComponents.ts
import { lazyWithRetry } from '@/lib/lazyWithRetry'

export const Dashboard = lazyWithRetry(() => import('@/dashboard'))
export const ErrorPage = lazyWithRetry(() => import('@/error-page'))
export const Login = lazyWithRetry(() => import('@/pages/Auth/Login'))
export const Signup = lazyWithRetry(() => import('@/pages/Auth/Signup'))
export const SignupWizard = lazyWithRetry(() => import('@/pages/Auth/SignupWizard'))
export const SetupWizard = lazyWithRetry(() => import('@/pages/Setup/SetupWizard'))
export const ForgotPassword = lazyWithRetry(() => import('@/pages/Auth/ForgotPassword'))
export const ResetPassword = lazyWithRetry(() => import('@/pages/Auth/ResetPassword'))
export const EmailVerification = lazyWithRetry(() => import('@/pages/Auth/EmailVerification'))
export const GoogleOAuthCallback = lazyWithRetry(() => import('@/pages/Auth/GoogleOAuthCallback'))
export const OnboardingWizard = lazyWithRetry(() => import('@/pages/Onboarding/OnboardingWizard'))
export const Home = lazyWithRetry(() => import('@/pages/Home'))
export const AvailableBalance = lazyWithRetry(() => import('@/pages/AvailableBalance/AvailableBalance'))
export const Categories = lazyWithRetry(() => import('@/pages/Menu/Categories/Categories'))
export const CategoryId = lazyWithRetry(() => import('@/pages/Menu/Categories/categoryId'))
export const CreateCategory = lazyWithRetry(() => import('@/pages/Menu/Categories/createCategory'))
export const MenuMakerLayout = lazyWithRetry(() => import('@/pages/Menu/MenuMakerLayout'))
export const CreateMenu = lazyWithRetry(() => import('@/pages/Menu/Menus/createMenu'))
export const Menus = lazyWithRetry(() => import('@/pages/Menu/Menus/Menus'))
export const ModifierGroups = lazyWithRetry(() => import('@/pages/Menu/Modifiers/ModifierGroups'))
export const ModifierGroupId = lazyWithRetry(() => import('@/pages/Menu/Modifiers/ModifierGroupId'))
export const CreateModifierGroup = lazyWithRetry(() => import('@/pages/Menu/Modifiers/createModifierGroup'))
export const MenuOverview = lazyWithRetry(() => import('@/pages/Menu/MenuOverview'))
export const CreateProduct = lazyWithRetry(() => import('@/pages/Menu/Products/createProduct'))
export const Products = lazyWithRetry(() => import('@/pages/Menu/Products/Products'))
export const ProductId = lazyWithRetry(() => import('@/pages/Menu/Products/productId'))
export const ReceiptViewer = lazyWithRetry(() => import('@/pages/Payment/ReceiptViewer'))

export const CreateTpv = lazyWithRetry(() => import('@/pages/Tpv/createTpv'))
export const Tpv = lazyWithRetry(() => import('@/pages/Tpv/Tpvs'))
export const TpvId = lazyWithRetry(() => import('@/pages/Tpv/TpvId'))
export const Account = lazyWithRetry(() => import('@/pages/Account/Account'))
export const Payments = lazyWithRetry(() => import('@/pages/Payment/Payments'))
export const PaymentId = lazyWithRetry(() => import('@/pages/Payment/PaymentId'))
export const MenuId = lazyWithRetry(() => import('@/pages/Menu/Menus/menuId'))
export const Reviews = lazyWithRetry(() => import('@/pages/Review/Reviews'))
// export const Waiters = lazyWithRetry(() => import('@/pages/Waiter/Waiters'))
export const Teams = lazyWithRetry(() => import('@/pages/Team/Teams'))
export const TeamId = lazyWithRetry(() => import('@/pages/Team/TeamId'))
export const VenueEditLayout = lazyWithRetry(() => import('@/pages/Venue/VenueEditLayout'))
export const BasicInfo = lazyWithRetry(() => import('@/pages/Venue/Edit/BasicInfo'))
export const ContactImages = lazyWithRetry(() => import('@/pages/Venue/Edit/ContactImages'))
export const VenueDocuments = lazyWithRetry(() => import('@/pages/Venue/Edit/Documents'))
export const VenueIntegrations = lazyWithRetry(() => import('@/pages/Venue/Edit/Integrations'))
export const VenuePaymentConfig = lazyWithRetry(() => import('@/pages/Venue/VenuePaymentConfig'))
export const VenueMerchantAccounts = lazyWithRetry(() => import('@/pages/Venue/VenueMerchantAccounts'))
export const EcommerceMerchants = lazyWithRetry(() => import('@/pages/Venue/EcommerceMerchants'))
export const Shifts = lazyWithRetry(() => import('@/pages/Shift/Shifts'))
// export const WaiterId = lazyWithRetry(() => import('@/pages/Waiter/waiterId'))
export const ShiftId = lazyWithRetry(() => import('@/pages/Shift/ShiftId'))

// Bill components
export const Orders = lazyWithRetry(() => import('@/pages/Order/Orders'))
export const OrderId = lazyWithRetry(() => import('@/pages/Order/OrderId'))

// Admin components
export const AcceptAdminInvitation = lazyWithRetry(() => import('@/pages/Admin/AcceptAdminInvitation'))
export const InviteAccept = lazyWithRetry(() => import('@/pages/InviteAccept'))
export const AdminDashboard = lazyWithRetry(() => import('@/pages/Admin/DEPRECATEDAdminDashboard'))
export const UserManagement = lazyWithRetry(() => import('@/pages/Admin/DEPRECATEDUserManagement'))
export const SystemSettings = lazyWithRetry(() => import('@/pages/Admin/DEPRECATEDSystemSettings'))
export const VenueManagement = lazyWithRetry(() => import('@/pages/Admin/DEPRECATEDVenueManagement'))
export const GlobalConfig = lazyWithRetry(() => import('@/pages/Admin/DEPRECATEDGlobalConfig'))
export const SuperAdminManagement = lazyWithRetry(() => import('@/pages/Admin/SuperAdminManagement'))
export const SuperAdminVenueEdit = lazyWithRetry(() => import('@/pages/Admin/SuperAdminVenueEdit'))

export const Venues = lazyWithRetry(() => import('@/pages/Venue/Venues'))
export const Notifications = lazyWithRetry(() => import('@/pages/Notifications/Notifications'))
export const NotificationPreferences = lazyWithRetry(() => import('@/pages/Notifications/NotificationPreferences'))

// New Superadmin System Components (temporary direct imports for debugging)
export { default as SuperadminLayout } from '@/pages/Superadmin/SuperadminLayout'
export { default as SuperadminDashboard } from '@/pages/Superadmin/SuperadminDashboard'
export { default as SuperadminFeatureManagement } from '@/pages/Superadmin/FeatureManagement'
export { default as SuperadminVenueManagement } from '@/pages/Superadmin/VenueManagement'
export { default as KYCReview } from '@/pages/Superadmin/KYCReview'
export { default as RevenueDashboard } from '@/pages/Superadmin/RevenueDashboard'
export { default as ProfitAnalyticsDashboard } from '@/pages/Superadmin/ProfitAnalyticsDashboard'
export { default as TestingPayments } from '@/pages/Superadmin/Testing/TestingPayments'
export { default as PaymentProviders } from '@/pages/Superadmin/PaymentProviders'
export { default as MerchantAccounts } from '@/pages/Superadmin/MerchantAccounts'
export { default as Terminals } from '@/pages/Superadmin/Terminals'
export { default as PaymentAnalytics } from '@/pages/Superadmin/PaymentAnalytics'
export { default as CostStructures } from '@/pages/Superadmin/CostStructures'
export { default as SettlementConfigurations } from '@/pages/Superadmin/SettlementConfigurations'
export { default as VenuePricing } from '@/pages/Superadmin/VenuePricing'
export { default as Webhooks } from '@/pages/Superadmin/Webhooks'
export { default as CreditAssessment } from '@/pages/Superadmin/CreditAssessment'
export { default as ModuleManagement } from '@/pages/Superadmin/ModuleManagement'
export { default as OrganizationManagement } from '@/pages/Superadmin/OrganizationManagement'
export { default as StaffManagement } from '@/pages/Superadmin/StaffManagement'
export { default as MasterTotpSetup } from '@/pages/Superadmin/MasterTotpSetup'
export { default as TpvUpdates } from '@/pages/Superadmin/TpvUpdates'
export { default as PushNotifications } from '@/pages/Superadmin/PushNotifications'
export { default as MarketingPage } from '@/pages/Superadmin/Marketing/MarketingPage'
export { default as CampaignEditor } from '@/pages/Superadmin/Marketing/CampaignEditor'
export { default as CampaignDetail } from '@/pages/Superadmin/Marketing/CampaignDetail'
export { default as TemplatesPage } from '@/pages/Superadmin/Marketing/TemplatesPage'
export { default as OnboardingWizardPage } from '@/pages/Superadmin/Onboarding/OnboardingWizardPage'
export { default as BulkOnboardingPage } from '@/pages/Superadmin/BulkOnboarding/BulkOnboardingPage'
export { default as ServerHealth } from '@/pages/Superadmin/ServerHealth'
export { default as TrainingManagement } from '@/pages/Superadmin/TrainingManagement'
export { default as TrainingDetail } from '@/pages/Superadmin/TrainingDetail'

// Superadmin V2 Layout
export { default as SuperadminV2Layout } from '@/pages/SuperadminV2/SuperadminV2Layout'

// Legal components
export const Terms = lazyWithRetry(() => import('@/pages/Legal/Terms'))
export const Privacy = lazyWithRetry(() => import('@/pages/Legal/Privacy'))

// Analytics
export const AnalyticsLayout = lazyWithRetry(() => import('@/pages/Analytics/AnalyticsLayout'))
export const AnalyticsOverview = lazyWithRetry(() => import('@/pages/Analytics/AnalyticsOverview'))

// Inventory
export const InventoryLayout = lazyWithRetry(() => import('@/pages/Inventory/InventoryLayout'))
export const InventorySummary = lazyWithRetry(() => import('@/pages/Inventory/InventorySummary'))
export const RawMaterials = lazyWithRetry(() => import('@/pages/Inventory/RawMaterials'))
export const ProductStock = lazyWithRetry(() => import('@/pages/Inventory/ProductStock'))
export const InventoryHistory = lazyWithRetry(() => import('@/pages/Inventory/InventoryHistory'))
export const Recipes = lazyWithRetry(() => import('@/pages/Inventory/Recipes'))
export const Pricing = lazyWithRetry(() => import('@/pages/Inventory/Pricing'))
export const ModifierInventory = lazyWithRetry(() => import('@/pages/Inventory/ModifierInventory'))
export const ModifierAnalytics = lazyWithRetry(() => import('@/pages/Inventory/ModifierAnalytics'))
export const SuppliersPage = lazyWithRetry(() => import('@/pages/Inventory/Suppliers/SuppliersPage'))
export const PurchaseOrdersPage = lazyWithRetry(() => import('@/pages/Inventory/PurchaseOrders/PurchaseOrdersPage'))
export const PurchaseOrderDetailPage = lazyWithRetry(() => import('@/pages/Inventory/PurchaseOrders/PurchaseOrderDetailPage'))


// Settings
export const RolePermissions = lazyWithRetry(() => import('@/pages/Settings/RolePermissions'))
export const GoogleIntegration = lazyWithRetry(() => import('@/pages/Settings/GoogleIntegration'))

// Billing pages
export const BillingLayout = lazyWithRetry(() => import('@/pages/Settings/Billing/BillingLayout'))
export const BillingSubscriptions = lazyWithRetry(() => import('@/pages/Settings/Billing/Subscriptions'))
export const BillingHistory = lazyWithRetry(() => import('@/pages/Settings/Billing/History'))
export const BillingPaymentMethods = lazyWithRetry(() => import('@/pages/Settings/Billing/PaymentMethods'))
export const BillingTokens = lazyWithRetry(() => import('@/pages/Settings/Billing/Tokens'))

// Customers
export const Customers = lazyWithRetry(() => import('@/pages/Customers/Customers'))
export const CustomerDetail = lazyWithRetry(() => import('@/pages/Customers/CustomerDetail'))
export const CustomerGroups = lazyWithRetry(() => import('@/pages/Customers/CustomerGroups'))

// Public Booking
export const PublicBookingPage = lazyWithRetry(() => import('@/pages/Booking/PublicBookingPage'))
export const BookingManagePage = lazyWithRetry(() => import('@/pages/Booking/BookingManagePage'))

// Reservations
export const ReservationsPage = lazyWithRetry(() => import('@/pages/Reservations/Reservations'))
export const ReservationDetail = lazyWithRetry(() => import('@/pages/Reservations/ReservationDetail'))
export const CreateReservation = lazyWithRetry(() => import('@/pages/Reservations/CreateReservation'))
export const ReservationCalendar = lazyWithRetry(() => import('@/pages/Reservations/ReservationCalendar'))
export const ReservationWaitlist = lazyWithRetry(() => import('@/pages/Reservations/Waitlist'))
export const ReservationSettingsPage = lazyWithRetry(() => import('@/pages/Reservations/ReservationSettings'))
export const OnlineBookingPage = lazyWithRetry(() => import('@/pages/Reservations/OnlineBookingPage'))

// Loyalty
export const LoyaltySettings = lazyWithRetry(() => import('@/pages/Loyalty/LoyaltySettings'))

// Promotions
export const Discounts = lazyWithRetry(() => import('@/pages/Promotions/Discounts'))
export const DiscountForm = lazyWithRetry(() => import('@/pages/Promotions/DiscountForm'))
export const DiscountDetail = lazyWithRetry(() => import('@/pages/Promotions/Discounts/DiscountDetail'))
export const Coupons = lazyWithRetry(() => import('@/pages/Promotions/Coupons'))
export const CouponForm = lazyWithRetry(() => import('@/pages/Promotions/CouponForm'))

// Organization (OWNER dashboard)
export const OrganizationLayout = lazyWithRetry(() => import('@/pages/Organization/OrganizationLayout'))
export const OrganizationDashboard = lazyWithRetry(() => import('@/pages/Organization/OrganizationDashboard'))
export const OrganizationVenues = lazyWithRetry(() => import('@/pages/Organization/OrganizationVenues'))
export const OrganizationTeam = lazyWithRetry(() => import('@/pages/Organization/OrganizationTeam'))
export const OrganizationSettings = lazyWithRetry(() => import('@/pages/Organization/OrganizationSettings'))

// White-Label Organization (multi-venue dashboard using orgSlug)
export const WLOrganizationLayout = lazyWithRetry(() => import('@/pages/organizations/WLOrganizationLayout'))
export const WLVisionGlobal = lazyWithRetry(() => import('@/pages/organizations/VisionGlobal/VisionGlobal'))
export const WLTiendasList = lazyWithRetry(() => import('@/pages/organizations/TiendasList/TiendasList'))
export const WLManagersDashboard = lazyWithRetry(() => import('@/pages/organizations/ManagersDashboard/ManagersDashboard'))

// Reports
export const PayLaterAging = lazyWithRetry(() => import('@/pages/Reports/PayLaterAging'))
export const SalesSummary = lazyWithRetry(() => import('@/pages/Reports/SalesSummary'))
export const SalesByItem = lazyWithRetry(() => import('@/pages/Reports/SalesByItem'))

// Demo Pages (temporary)
export const SerializedSalesDemo = lazyWithRetry(() => import('@/pages/SerializedSalesDemo'))

// Commissions
export const CommissionsPage = lazyWithRetry(() => import('@/pages/Commissions/CommissionsPage'))
export const CommissionConfigDetailPage = lazyWithRetry(() => import('@/pages/Commissions/CommissionConfigDetailPage'))

// PlayTelecom (Serialized Inventory Dashboard)
export const PlayTelecomLayout = lazyWithRetry(() => import('@/pages/playtelecom/PlayTelecomLayout'))
export const PlayTelecomCommandCenter = lazyWithRetry(() => import('@/pages/playtelecom/CommandCenter/CommandCenter'))
export const PlayTelecomStock = lazyWithRetry(() => import('@/pages/playtelecom/Stock/StockControl'))
export const PlayTelecomSales = lazyWithRetry(() => import('@/pages/playtelecom/Sales/SalesReport'))
export const PlayTelecomStores = lazyWithRetry(() => import('@/pages/playtelecom/Stores/StoresAnalysis'))
export const PlayTelecomManagers = lazyWithRetry(() => import('@/pages/playtelecom/Managers/ManagersDashboard'))
export const PlayTelecomPromoters = lazyWithRetry(() => import('@/pages/playtelecom/PromotersAudit/PromotersAuditPage'))
export const PlayTelecomUsers = lazyWithRetry(() => import('@/pages/playtelecom/Users/UsersManagement'))
export const PlayTelecomTpvConfig = lazyWithRetry(() => import('@/pages/playtelecom/TpvConfig/TpvConfiguration'))
export const PlayTelecomSupervisor = lazyWithRetry(() => import('@/pages/playtelecom/Supervisor/SupervisorDashboard'))
export const PlayTelecomReporte = lazyWithRetry(() => import('@/pages/playtelecom/Reporte/ReportePage'))

// White-Label Builder (Superadmin)
// Note: WhiteLabelDashboardLayout, WhiteLabelIndex, WhiteLabelFeatureRouter removed
// White-label now uses direct routes, not a separate /wl/ section
export const WhiteLabelWizard = lazyWithRetry(() => import('@/pages/Superadmin/WhiteLabelBuilder/WhiteLabelWizard'))
