// src/routes/lazyComponents.ts
import React from 'react'

export const Dashboard = React.lazy(() => import('@/dashboard'))
export const ErrorPage = React.lazy(() => import('@/error-page'))
export const Login = React.lazy(() => import('@/pages/Auth/Login'))
export const GoogleOAuthCallback = React.lazy(() => import('@/pages/Auth/GoogleOAuthCallback'))
export const Home = React.lazy(() => import('@/pages/Home'))
export const Categories = React.lazy(() => import('@/pages/Menu/Categories/Categories'))
export const CategoryId = React.lazy(() => import('@/pages/Menu/Categories/categoryId'))
export const CreateCategory = React.lazy(() => import('@/pages/Menu/Categories/createCategory'))
export const MenuMakerLayout = React.lazy(() => import('@/pages/Menu/MenuMakerLayout'))
export const CreateMenu = React.lazy(() => import('@/pages/Menu/Menus/createMenu'))
export const Menus = React.lazy(() => import('@/pages/Menu/Menus/Menus'))
export const ModifierGroups = React.lazy(() => import('@/pages/Menu/Modifiers/ModifierGroups'))
export const ModifierGroupId = React.lazy(() => import('@/pages/Menu/Modifiers/ModifierGroupId'))
export const CreateModifierGroup = React.lazy(() => import('@/pages/Menu/Modifiers/createModifierGroup'))
export const Overview = React.lazy(() => import('@/pages/Menu/Overview'))
export const CreateProduct = React.lazy(() => import('@/pages/Menu/Products/createProduct'))
export const Products = React.lazy(() => import('@/pages/Menu/Products/Products'))
export const ProductId = React.lazy(() => import('@/pages/Menu/Products/productId'))
export const ReceiptViewer = React.lazy(() => import('@/pages/Payment/ReceiptViewer'))
export const ReceiptPreview = React.lazy(() => import('@/components/receipts/ReceiptPreview'))

export const CreateTpv = React.lazy(() => import('@/pages/Tpv/createTpv'))
export const Tpv = React.lazy(() => import('@/pages/Tpv/Tpvs'))
export const TpvId = React.lazy(() => import('@/pages/Tpv/TpvId'))
export const Account = React.lazy(() => import('@/pages/Account/Account'))
export const Payments = React.lazy(() => import('@/pages/Payment/Payments'))
export const PaymentId = React.lazy(() => import('@/pages/Payment/PaymentId'))
export const MenuId = React.lazy(() => import('@/pages/Menu/Menus/menuId'))
export const Reviews = React.lazy(() => import('@/pages/Review/Reviews'))
// export const Waiters = React.lazy(() => import('@/pages/Waiter/Waiters'))
export const Teams = React.lazy(() => import('@/pages/Team/Teams'))
export const TeamMemberDetails = React.lazy(() => import('@/pages/Team/TeamMemberDetails'))
export const EditVenue = React.lazy(() => import('@/pages/Venue/Venue.edit'))
export const Shifts = React.lazy(() => import('@/pages/Shift/Shifts'))
// export const WaiterId = React.lazy(() => import('@/pages/Waiter/waiterId'))
export const ShiftId = React.lazy(() => import('@/pages/Shift/ShiftId'))

// Bill components
export const Orders = React.lazy(() => import('@/pages/Order/Orders'))
export const OrderId = React.lazy(() => import('@/pages/Order/OrderId'))

// Admin components
export const AcceptAdminInvitation = React.lazy(() => import('@/pages/Admin/AcceptAdminInvitation'))
export const InviteAccept = React.lazy(() => import('@/pages/InviteAccept'))
export const AdminDashboard = React.lazy(() => import('@/pages/Admin/AdminDashboard'))
export const UserManagement = React.lazy(() => import('@/pages/Admin/UserManagement'))
export const SystemSettings = React.lazy(() => import('@/pages/Admin/SystemSettings'))
export const VenueManagement = React.lazy(() => import('@/pages/Admin/VenueManagement'))
export const GlobalConfig = React.lazy(() => import('@/pages/Admin/GlobalConfig'))
export const SuperAdminManagement = React.lazy(() => import('@/pages/Admin/SuperAdminManagement'))
export const SuperAdminVenueEdit = React.lazy(() => import('@/pages/Admin/SuperAdminVenueEdit'))

export const Venues = React.lazy(() => import('@/pages/Venue/Venues'))
export const Notifications = React.lazy(() => import('@/pages/Notifications/Notifications'))
export const NotificationPreferences = React.lazy(() => import('@/pages/Notifications/NotificationPreferences'))

// New Superadmin System Components (temporary direct imports for debugging)
export { default as SuperadminLayout } from '@/pages/Superadmin/SuperadminLayout'
export { default as SuperadminDashboard } from '@/pages/Superadmin/SuperadminDashboard'
export { default as SuperadminFeatureManagement } from '@/pages/Superadmin/FeatureManagement'
export { default as SuperadminVenueManagement } from '@/pages/Superadmin/VenueManagement'
export { default as RevenueDashboard } from '@/pages/Superadmin/RevenueDashboard'
