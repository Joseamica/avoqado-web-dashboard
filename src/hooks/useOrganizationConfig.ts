/**
 * useOrganizationConfig - Hooks for org-level configuration
 * Uses orgId directly from useCurrentOrganization(), no venue dependency.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import {
  getOrgGoals,
  createOrgGoal,
  updateOrgGoal,
  deleteOrgGoal,
  getOrgAttendanceConfig,
  upsertOrgAttendanceConfig,
  deleteOrgAttendanceConfig,
  getOrgTpvDefaults,
  upsertOrgTpvDefaults,
  getOrgTpvStats,
  getOrgCategories,
  createOrgCategory,
  updateOrgCategory,
  deleteOrgCategory,
  type CreateOrgGoalInput,
  type UpdateOrgGoalInput,
  type CreateItemCategoryDto,
  type UpdateItemCategoryDto,
} from '@/services/organizationConfig.service'

// ===== ORG GOALS =====

export function useOrgConfigGoals(options?: { enabled?: boolean }) {
  const { orgId } = useCurrentOrganization()

  return useQuery({
    queryKey: ['org-config', orgId, 'goals'],
    queryFn: () => getOrgGoals(orgId!),
    enabled: options?.enabled !== false && !!orgId,
    staleTime: 60000,
  })
}

export function useCreateOrgConfigGoal() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrgGoalInput) => createOrgGoal(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'goals'] })
    },
  })
}

export function useUpdateOrgConfigGoal() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: UpdateOrgGoalInput }) =>
      updateOrgGoal(orgId!, goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'goals'] })
    },
  })
}

export function useDeleteOrgConfigGoal() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (goalId: string) => deleteOrgGoal(orgId!, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'goals'] })
    },
  })
}

// ===== ORG ATTENDANCE / TPV CONFIG =====

export function useOrgAttendanceConfig(options?: { enabled?: boolean }) {
  const { orgId } = useCurrentOrganization()

  return useQuery({
    queryKey: ['org-config', orgId, 'attendance-config'],
    queryFn: () => getOrgAttendanceConfig(orgId!),
    enabled: options?.enabled !== false && !!orgId,
    staleTime: 60000,
  })
}

export function useUpsertOrgAttendanceConfig() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => upsertOrgAttendanceConfig(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'attendance-config'] })
    },
  })
}

export function useDeleteOrgAttendanceConfig() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteOrgAttendanceConfig(orgId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'attendance-config'] })
    },
  })
}

export function useOrgTpvDefaults(options?: { enabled?: boolean }) {
  const { orgId } = useCurrentOrganization()

  return useQuery({
    queryKey: ['org-config', orgId, 'tpv-defaults'],
    queryFn: () => getOrgTpvDefaults(orgId!),
    enabled: options?.enabled !== false && !!orgId,
    staleTime: 60000,
  })
}

export function useUpsertOrgTpvDefaults() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => upsertOrgTpvDefaults(orgId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'tpv-defaults'] })
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'tpv-stats'] })
    },
  })
}

export function useOrgTpvStats(options?: { enabled?: boolean }) {
  const { orgId } = useCurrentOrganization()

  return useQuery({
    queryKey: ['org-config', orgId, 'tpv-stats'],
    queryFn: () => getOrgTpvStats(orgId!),
    enabled: options?.enabled !== false && !!orgId,
    staleTime: 60000,
  })
}

// ===== ORG CATEGORIES =====

export function useOrgConfigCategories(options?: { enabled?: boolean }) {
  const { orgId } = useCurrentOrganization()

  return useQuery({
    queryKey: ['org-config', orgId, 'categories'],
    queryFn: () => getOrgCategories(orgId!),
    enabled: options?.enabled !== false && !!orgId,
    staleTime: 60000,
  })
}

export function useCreateOrgConfigCategory() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateItemCategoryDto) =>
      createOrgCategory(orgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'categories'] })
    },
  })
}

export function useUpdateOrgConfigCategory() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateItemCategoryDto }) =>
      updateOrgCategory(orgId!, categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'categories'] })
    },
  })
}

export function useDeleteOrgConfigCategory() {
  const { orgId } = useCurrentOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (categoryId: string) => deleteOrgCategory(orgId!, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'categories'] })
    },
  })
}
