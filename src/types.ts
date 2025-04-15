export interface Venue {
  id: string
  name: string
  plan: string
  logo: string
  // Add other venue-related fields
}

export interface User {
  id: string
  name: string
  role: string
  email: string
  image: string
  venues: Venue[]
}
export interface AvoqadoMenu {
  id: string
  name: string
  shortDesc?: string | null
  longDesc?: string | null
  active: boolean
  isFixed: boolean
  startTime?: string | null
  startTimeV2?: Date | null
  endTimeV2?: Date | null
  endTime?: string | null
  imageCover?: string | null
  languageId: string
  venueId: string
  updatedAt: string
  createdAt: string
}

export interface ModifierGroup {
  id: string
  name: string
  description?: string | null
  orderByNumber?: number | null
  active: boolean
  venueId: string
  updatedAt: string
  createdAt: string
}

export interface AvoqadoProduct {
  id: string
  sku?: string | null
  key?: string | null
  type?: string | null
  name: string
  imageUrl?: string | null
  quantityUnit?: string | null
  description?: string | null
  orderByNumber?: number | null
  instagramUrl?: string | null
  price: string
  active: boolean
  calories?: number | null
  venueId: string
  updatedAt: string
  createdAt: string
}

export interface Payment {
  id: string
  paymentType: string
  amount: string
  currency: string
  status: string
  createdAt: string
  method: string
  updatedAt: string
  venueId: string
  last4: string
  tips: any[]
  cardBrand: string
}

export interface Category {
  id: string
  name: string
  image?: string | null
  displayBill?: boolean | null
  description?: string | null
  orderByNumber?: number | null
  color?: string | null
  pdf: boolean
  active: boolean
  menuId?: string | null
  venueId: string
  updatedAt: string
  createdAt: string
  avoqadoProducts: AvoqadoProduct[]
  avoqadoMenus: AvoqadoMenu[]
}

export interface Tpv {
  id: string
  name: string
  serial: string
  version: string
  configuration: string
  venueId: string
  updatedAt: string
  createdAt: string
}

export interface Users {
  id: string
  name: string
  email: string
  venues: Venue[]
}
