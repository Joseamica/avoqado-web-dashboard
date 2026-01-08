// src/routes/lazyComponents.ts
import { lazyWithRetry } from '@/lib/lazyWithRetry'

export const Dashboard = lazyWithRetry(() => import('@/dashboard'))
export const ErrorPage = lazyWithRetry(() => import('@/error-page'))
export const Login = lazyWithRetry(() => import('@/pages/Auth/Login'))
export const Signup = lazyWithRetry(() => import('@/pages/Auth/Signup'))
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
export const TeamMemberDetails = lazyWithRetry(() => import('@/pages/Team/TeamMemberDetails'))
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

// Legal components
export const Terms = lazyWithRetry(() => import('@/pages/Legal/Terms'))
export const Privacy = lazyWithRetry(() => import('@/pages/Legal/Privacy'))

// Analytics
export const AnalyticsLayout = lazyWithRetry(() => import('@/pages/Analytics/AnalyticsLayout'))
export const AnalyticsOverview = lazyWithRetry(() => import('@/pages/Analytics/AnalyticsOverview'))

// Inventory
export const InventoryLayout = lazyWithRetry(() => import('@/pages/Inventory/InventoryLayout'))
export const RawMaterials = lazyWithRetry(() => import('@/pages/Inventory/RawMaterials'))
export const ProductStock = lazyWithRetry(() => import('@/pages/Inventory/ProductStock'))
export const Recipes = lazyWithRetry(() => import('@/pages/Inventory/Recipes'))
export const Pricing = lazyWithRetry(() => import('@/pages/Inventory/Pricing'))
export const ModifierInventory = lazyWithRetry(() => import('@/pages/Inventory/ModifierInventory'))

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

// Reports
export const PayLaterAging = lazyWithRetry(() => import('@/pages/Reports/PayLaterAging'))
export const SalesSummary = lazyWithRetry(() => import('@/pages/Reports/SalesSummary'))
export const SalesByItem = lazyWithRetry(() => import('@/pages/Reports/SalesByItem'))
