/**
 * Sector-Aware Terminology Configuration
 *
 * Single source of truth for bilingual (ES/EN) UI labels per business sector.
 * Each business category has specific terminology that adapts the dashboard labels
 * to match the sector's vocabulary.
 *
 * Resolution order: VenueRoleConfig DB override > sector default > FOOD_SERVICE fallback
 */

import type { BusinessCategory } from '@/types'

// ==========================================
// Term Keys
// ==========================================

export type TermKey =
  | 'menu'
  | 'menuPlural'
  | 'item'
  | 'itemPlural'
  | 'order'
  | 'orderPlural'
  | 'table'
  | 'tablePlural'
  | 'waiter'
  | 'waiterPlural'
  | 'cashier'
  | 'cashierPlural'
  | 'kitchen'
  | 'kitchenPlural'
  | 'host'
  | 'hostPlural'

export type SectorTerms = Record<TermKey, string>

export type SupportedLocale = 'es' | 'en'

// ==========================================
// Bilingual Terminology Data
// ==========================================

export const SECTOR_TERMINOLOGY: Record<BusinessCategory, Record<SupportedLocale, SectorTerms>> = {
  FOOD_SERVICE: {
    es: {
      menu: 'Menu',
      menuPlural: 'Menus',
      item: 'Platillo',
      itemPlural: 'Platillos',
      order: 'Orden',
      orderPlural: 'Ordenes',
      table: 'Mesa',
      tablePlural: 'Mesas',
      waiter: 'Mesero',
      waiterPlural: 'Meseros',
      cashier: 'Cajero',
      cashierPlural: 'Cajeros',
      kitchen: 'Cocina',
      kitchenPlural: 'Cocinas',
      host: 'Host',
      hostPlural: 'Hosts',
    },
    en: {
      menu: 'Menu',
      menuPlural: 'Menus',
      item: 'Dish',
      itemPlural: 'Dishes',
      order: 'Order',
      orderPlural: 'Orders',
      table: 'Table',
      tablePlural: 'Tables',
      waiter: 'Waiter',
      waiterPlural: 'Waiters',
      cashier: 'Cashier',
      cashierPlural: 'Cashiers',
      kitchen: 'Kitchen',
      kitchenPlural: 'Kitchens',
      host: 'Host',
      hostPlural: 'Hosts',
    },
  },
  RETAIL: {
    es: {
      menu: 'Catalogo',
      menuPlural: 'Catalogos',
      item: 'Producto',
      itemPlural: 'Productos',
      order: 'Venta',
      orderPlural: 'Ventas',
      table: 'Caja',
      tablePlural: 'Cajas',
      waiter: 'Vendedor',
      waiterPlural: 'Vendedores',
      cashier: 'Cajero',
      cashierPlural: 'Cajeros',
      kitchen: 'Almacen',
      kitchenPlural: 'Almacenes',
      host: 'Recepcionista',
      hostPlural: 'Recepcionistas',
    },
    en: {
      menu: 'Catalog',
      menuPlural: 'Catalogs',
      item: 'Product',
      itemPlural: 'Products',
      order: 'Sale',
      orderPlural: 'Sales',
      table: 'Register',
      tablePlural: 'Registers',
      waiter: 'Sales Associate',
      waiterPlural: 'Sales Associates',
      cashier: 'Cashier',
      cashierPlural: 'Cashiers',
      kitchen: 'Warehouse',
      kitchenPlural: 'Warehouses',
      host: 'Receptionist',
      hostPlural: 'Receptionists',
    },
  },
  SERVICES: {
    es: {
      menu: 'Servicios',
      menuPlural: 'Servicios',
      item: 'Servicio',
      itemPlural: 'Servicios',
      order: 'Cita',
      orderPlural: 'Citas',
      table: 'Estacion',
      tablePlural: 'Estaciones',
      waiter: 'Especialista',
      waiterPlural: 'Especialistas',
      cashier: 'Recepcionista',
      cashierPlural: 'Recepcionistas',
      kitchen: 'Area de Servicio',
      kitchenPlural: 'Areas de Servicio',
      host: 'Recepcionista',
      hostPlural: 'Recepcionistas',
    },
    en: {
      menu: 'Services',
      menuPlural: 'Services',
      item: 'Service',
      itemPlural: 'Services',
      order: 'Appointment',
      orderPlural: 'Appointments',
      table: 'Station',
      tablePlural: 'Stations',
      waiter: 'Specialist',
      waiterPlural: 'Specialists',
      cashier: 'Receptionist',
      cashierPlural: 'Receptionists',
      kitchen: 'Service Area',
      kitchenPlural: 'Service Areas',
      host: 'Receptionist',
      hostPlural: 'Receptionists',
    },
  },
  HOSPITALITY: {
    es: {
      menu: 'Servicios',
      menuPlural: 'Servicios',
      item: 'Servicio',
      itemPlural: 'Servicios',
      order: 'Reservacion',
      orderPlural: 'Reservaciones',
      table: 'Habitacion',
      tablePlural: 'Habitaciones',
      waiter: 'Concierge',
      waiterPlural: 'Concierges',
      cashier: 'Recepcionista',
      cashierPlural: 'Recepcionistas',
      kitchen: 'Servicio a Cuartos',
      kitchenPlural: 'Servicios a Cuartos',
      host: 'Recepcionista',
      hostPlural: 'Recepcionistas',
    },
    en: {
      menu: 'Services',
      menuPlural: 'Services',
      item: 'Service',
      itemPlural: 'Services',
      order: 'Reservation',
      orderPlural: 'Reservations',
      table: 'Room',
      tablePlural: 'Rooms',
      waiter: 'Concierge',
      waiterPlural: 'Concierges',
      cashier: 'Receptionist',
      cashierPlural: 'Receptionists',
      kitchen: 'Room Service',
      kitchenPlural: 'Room Services',
      host: 'Receptionist',
      hostPlural: 'Receptionists',
    },
  },
  ENTERTAINMENT: {
    es: {
      menu: 'Cartelera',
      menuPlural: 'Carteleras',
      item: 'Evento',
      itemPlural: 'Eventos',
      order: 'Entrada',
      orderPlural: 'Entradas',
      table: 'Sala',
      tablePlural: 'Salas',
      waiter: 'Staff',
      waiterPlural: 'Staff',
      cashier: 'Taquillero',
      cashierPlural: 'Taquilleros',
      kitchen: 'Backstage',
      kitchenPlural: 'Backstages',
      host: 'Recepcionista',
      hostPlural: 'Recepcionistas',
    },
    en: {
      menu: 'Events',
      menuPlural: 'Events',
      item: 'Event',
      itemPlural: 'Events',
      order: 'Ticket',
      orderPlural: 'Tickets',
      table: 'Hall',
      tablePlural: 'Halls',
      waiter: 'Staff',
      waiterPlural: 'Staff',
      cashier: 'Ticket Agent',
      cashierPlural: 'Ticket Agents',
      kitchen: 'Backstage',
      kitchenPlural: 'Backstages',
      host: 'Receptionist',
      hostPlural: 'Receptionists',
    },
  },
  OTHER: {
    es: {
      menu: 'Catalogo',
      menuPlural: 'Catalogos',
      item: 'Item',
      itemPlural: 'Items',
      order: 'Orden',
      orderPlural: 'Ordenes',
      table: 'Ubicacion',
      tablePlural: 'Ubicaciones',
      waiter: 'Asistente',
      waiterPlural: 'Asistentes',
      cashier: 'Cajero',
      cashierPlural: 'Cajeros',
      kitchen: 'Almacen',
      kitchenPlural: 'Almacenes',
      host: 'Recepcionista',
      hostPlural: 'Recepcionistas',
    },
    en: {
      menu: 'Catalog',
      menuPlural: 'Catalogs',
      item: 'Item',
      itemPlural: 'Items',
      order: 'Order',
      orderPlural: 'Orders',
      table: 'Location',
      tablePlural: 'Locations',
      waiter: 'Assistant',
      waiterPlural: 'Assistants',
      cashier: 'Cashier',
      cashierPlural: 'Cashiers',
      kitchen: 'Storage',
      kitchenPlural: 'Storages',
      host: 'Receptionist',
      hostPlural: 'Receptionists',
    },
  },
}

/**
 * Get sector terms for a specific category and locale.
 * Falls back to FOOD_SERVICE if category is unknown, and 'es' if locale is unsupported.
 */
export function getSectorTerms(category: BusinessCategory, locale: string): SectorTerms {
  const normalizedLocale = (locale.startsWith('en') ? 'en' : 'es') as SupportedLocale
  const sectorData = SECTOR_TERMINOLOGY[category] || SECTOR_TERMINOLOGY.FOOD_SERVICE
  return sectorData[normalizedLocale] || sectorData.es
}
