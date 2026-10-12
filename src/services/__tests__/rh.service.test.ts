// RH 1a: contrato con el servidor — `includeArchived` viaja como booleano (axios lo manda 'true'/'false'), y en el equipo
// `positionId` se OMITE cuando no hay filtro (una cadena vacía haría que el servidor responda 400 por el cuid).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rhService } from '../rh.service'
import { teamService } from '../team.service'
import { ROLES_SUGERIBLES } from '@/types/rh'

const m = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get } }))

beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } })
})

describe('contrato con el servidor de RH', () => {
  it('puestos: includeArchived llega como booleano y sin filtro no se manda', async () => {
    await rhService.positions('v1', { includeArchived: true, limit: 50, offset: 0 })
    expect(m.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/rh/positions', { params: { includeArchived: true, limit: 50, offset: 0 } })
    await rhService.positions('v1')
    expect(m.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/rh/positions', { params: {} })
  })

  it('equipo: positionId sólo viaja si hay uno; "" o undefined se omiten, y el 4º argumento sigue siendo la búsqueda', async () => {
    await teamService.getTeamMembers('v1', 1, 50, 'ana')
    expect(m.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/team?page=1&pageSize=50&search=ana')
    await teamService.getTeamMembers('v1', 1, 20, undefined, '')
    expect(m.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/team?page=1&pageSize=20')
    await teamService.getTeamMembers('v1', 2, 20, undefined, 'cm123')
    expect(m.get).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/team?page=2&pageSize=20&positionId=cm123')
  })

  it('el rol sugerible nunca incluye SUPERADMIN (el servidor lo rechaza)', () => {
    expect(ROLES_SUGERIBLES).not.toContain('SUPERADMIN')
    expect(ROLES_SUGERIBLES).toContain('MANAGER')
  })
})
