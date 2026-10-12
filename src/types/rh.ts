// RH fase 1a: puestos y asignaciones (espejo de la API `/api/v1/dashboard/venues/:venueId/rh`).
import { StaffRole } from '@/types'

/** Roles que un puesto puede sugerir. El servidor rechaza SUPERADMIN al crear o editar un puesto: el formulario no debe ofrecerlo. */
export const ROLES_SUGERIBLES: StaffRole[] = Object.values(StaffRole).filter(r => r !== StaffRole.SUPERADMIN)
export type WorkRelation = 'EMPLEADO_NOMINA' | 'ASIMILADO' | 'INDEPENDIENTE_FACTURA' | 'RENTA_SILLA'
export type PayComponentKind = 'SALARY' | 'HOURLY' | 'BONUS_FIXED' | 'CHAIR_RENT' | 'BONUS_CONDITIONAL'
export interface Puesto { id: string; name: string; color: string | null; icon: string | null; suggestedRole: string; suggestedRelation: WorkRelation | null; tracksAttendanceDefault: boolean; componentKinds: PayComponentKind[]; archivedAt: string | null; personasVigentes: number }
export interface Asignacion { id: string; staffId: string; positionId: string; positionName: string; relation: WorkRelation | null; effectiveFrom: string; effectiveTo: string | null; tracksAttendance: boolean; supersedesId: string | null }
export interface Pagina<T> { data: T[]; total: number; hasMore: boolean }
export interface ResumenDePago { comisiones: Array<{ configId: string; nombre: string; alcance: 'SEDE' | 'ORGANIZACION'; excluida: boolean; tasaPersonal: number | null }> | null; nivelDeClase: { nombre: string; desde: string } | null | 'SIN_PERMISO'; propinas: { regla: 'ATIENDE_LUEGO_COBRA' } }
