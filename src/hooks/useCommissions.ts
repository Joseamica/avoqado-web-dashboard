import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { commissionService } from '@/services/commission.service'
import type {
	CommissionConfig,
	CommissionTier,
	CommissionOverride,
	CommissionSummary,
	CommissionPayout,
	CreateCommissionConfigInput,
	UpdateCommissionConfigInput,
	CreateCommissionTierInput,
	UpdateCommissionTierInput,
	CreateCommissionOverrideInput,
	UpdateCommissionOverrideInput,
	CreatePayoutInput,
	AddBonusInput,
	AdjustSummaryInput,
	CommissionFilters,
	SummaryFilters,
	PayoutFilters,
} from '@/types/commission'
import { useCallback } from 'react'

// ============================================
// Query Key Factory
// ============================================

export const commissionKeys = {
	all: ['commissions'] as const,
	// Configs
	configs: (venueId: string | null) => [...commissionKeys.all, 'configs', venueId] as const,
	config: (venueId: string | null, configId: string) => [...commissionKeys.configs(venueId), configId] as const,
	// Tiers
	tiers: (venueId: string | null, configId: string) => [...commissionKeys.config(venueId, configId), 'tiers'] as const,
	tier: (venueId: string | null, tierId: string) => [...commissionKeys.all, 'tiers', venueId, tierId] as const,
	tierProgress: (venueId: string | null, configId: string, staffId: string) =>
		[...commissionKeys.config(venueId, configId), 'tier-progress', staffId] as const,
	// Overrides
	overrides: (venueId: string | null, configId: string) => [...commissionKeys.config(venueId, configId), 'overrides'] as const,
	override: (venueId: string | null, overrideId: string) => [...commissionKeys.all, 'overrides', venueId, overrideId] as const,
	// Staff Commissions
	staffCommissions: (venueId: string | null, staffId: string) => [...commissionKeys.all, 'staff', venueId, staffId] as const,
	myCommissions: (venueId: string | null) => [...commissionKeys.all, 'my', venueId] as const,
	calculations: (venueId: string | null) => [...commissionKeys.all, 'calculations', venueId] as const,
	// Summaries
	summaries: (venueId: string | null) => [...commissionKeys.all, 'summaries', venueId] as const,
	summary: (venueId: string | null, summaryId: string) => [...commissionKeys.summaries(venueId), summaryId] as const,
	pendingSummaries: (venueId: string | null) => [...commissionKeys.summaries(venueId), 'pending'] as const,
	// Payouts
	payouts: (venueId: string | null) => [...commissionKeys.all, 'payouts', venueId] as const,
	payout: (venueId: string | null, payoutId: string) => [...commissionKeys.payouts(venueId), payoutId] as const,
	staffPayouts: (venueId: string | null, staffId: string) => [...commissionKeys.payouts(venueId), 'staff', staffId] as const,
	// Stats
	stats: (venueId: string | null) => [...commissionKeys.all, 'stats', venueId] as const,
	payoutStats: (venueId: string | null) => [...commissionKeys.all, 'payout-stats', venueId] as const,
}

// ============================================
// CONFIG HOOKS
// ============================================

/**
 * Hook for fetching all commission configs for a venue
 */
export function useCommissionConfigs(includeInactive: boolean = false) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.configs(venueId), { includeInactive }],
		queryFn: () => commissionService.getConfigs(venueId!, includeInactive),
		enabled: !!venueId,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	})
}

/**
 * Hook for fetching a single commission config
 */
export function useCommissionConfig(configId: string | undefined) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.config(venueId, configId || ''),
		queryFn: () => commissionService.getConfig(venueId!, configId!),
		enabled: !!venueId && !!configId,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	})
}

/**
 * Hook for creating a commission config
 */
export function useCreateCommissionConfig() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreateCommissionConfigInput) => commissionService.createConfig(venueId!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.configs(venueId) })
		},
	})
}

/**
 * Hook for updating a commission config
 */
export function useUpdateCommissionConfig() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ configId, data }: { configId: string; data: UpdateCommissionConfigInput }) =>
			commissionService.updateConfig(venueId!, configId, data),
		onSuccess: (_, { configId }) => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.configs(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for deleting a commission config
 */
export function useDeleteCommissionConfig() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (configId: string) => commissionService.deleteConfig(venueId!, configId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.configs(venueId) })
		},
	})
}

// ============================================
// TIER HOOKS
// ============================================

/**
 * Hook for fetching tiers for a config
 */
export function useCommissionTiers(configId: string | undefined, includeInactive: boolean = false) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.tiers(venueId, configId || ''), { includeInactive }],
		queryFn: () => commissionService.getTiers(venueId!, configId!, includeInactive),
		enabled: !!venueId && !!configId,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	})
}

/**
 * Hook for creating a tier
 */
export function useCreateCommissionTier(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreateCommissionTierInput) => commissionService.createTier(venueId!, configId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.tiers(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for creating multiple tiers at once
 */
export function useCreateCommissionTiersBatch(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (tiers: CreateCommissionTierInput[]) => commissionService.createTiersBatch(venueId!, configId, tiers),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.tiers(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for updating a tier
 */
export function useUpdateCommissionTier(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ tierId, data }: { tierId: string; data: UpdateCommissionTierInput }) =>
			commissionService.updateTier(venueId!, tierId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.tiers(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for deleting a tier
 */
export function useDeleteCommissionTier(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (tierId: string) => commissionService.deleteTier(venueId!, tierId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.tiers(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for fetching staff tier progress
 */
export function useStaffTierProgress(configId: string | undefined, staffId: string | undefined) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.tierProgress(venueId, configId || '', staffId || ''),
		queryFn: () => commissionService.getStaffTierProgress(venueId!, configId!, staffId!),
		enabled: !!venueId && !!configId && !!staffId,
		staleTime: 2 * 60 * 1000, // 2 minutes - progress changes more frequently
		gcTime: 10 * 60 * 1000,
	})
}

// ============================================
// OVERRIDE HOOKS
// ============================================

/**
 * Hook for fetching overrides for a config
 */
export function useCommissionOverrides(configId: string | undefined, includeInactive: boolean = false) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.overrides(venueId, configId || ''), { includeInactive }],
		queryFn: () => commissionService.getOverrides(venueId!, configId!, includeInactive),
		enabled: !!venueId && !!configId,
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	})
}

/**
 * Hook for creating an override
 */
export function useCreateCommissionOverride(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreateCommissionOverrideInput) => commissionService.createOverride(venueId!, configId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.overrides(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for updating an override
 */
export function useUpdateCommissionOverride(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ overrideId, data }: { overrideId: string; data: UpdateCommissionOverrideInput }) =>
			commissionService.updateOverride(venueId!, overrideId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.overrides(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

/**
 * Hook for deleting an override
 */
export function useDeleteCommissionOverride(configId: string) {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (overrideId: string) => commissionService.deleteOverride(venueId!, overrideId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.overrides(venueId, configId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.config(venueId, configId) })
		},
	})
}

// ============================================
// STAFF COMMISSION HOOKS
// ============================================

/**
 * Hook for fetching commissions for a specific staff member
 */
export function useStaffCommissions(staffId: string | undefined, filters?: CommissionFilters) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.staffCommissions(venueId, staffId || ''), filters],
		queryFn: () => commissionService.getStaffCommissions(venueId!, staffId!, filters),
		enabled: !!venueId && !!staffId,
		staleTime: 2 * 60 * 1000, // 2 minutes
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching my own commissions (staff portal)
 */
export function useMyCommissions(filters?: CommissionFilters) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.myCommissions(venueId), filters],
		queryFn: () => commissionService.getMyCommissions(venueId!, filters),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching all commission calculations
 */
export function useCommissionCalculations(filters?: CommissionFilters) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.calculations(venueId), filters],
		queryFn: () => commissionService.getCalculations(venueId!, filters),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

// ============================================
// SUMMARY HOOKS
// ============================================

/**
 * Hook for fetching commission summaries
 */
export function useCommissionSummaries(filters?: SummaryFilters) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.summaries(venueId), filters],
		queryFn: () => commissionService.getSummaries(venueId!, filters),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching a single summary
 */
export function useCommissionSummary(summaryId: string | undefined) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.summary(venueId, summaryId || ''),
		queryFn: () => commissionService.getSummary(venueId!, summaryId!),
		enabled: !!venueId && !!summaryId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching pending summaries
 */
export function usePendingCommissionSummaries() {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.pendingSummaries(venueId),
		queryFn: () => commissionService.getPendingSummaries(venueId!),
		enabled: !!venueId,
		staleTime: 1 * 60 * 1000, // 1 minute - pending items change frequently
		gcTime: 5 * 60 * 1000,
	})
}

/**
 * Hook for approving a summary
 */
export function useApproveSummary() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (summaryId: string) => commissionService.approveSummary(venueId!, summaryId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
		},
	})
}

/**
 * Hook for batch approving summaries
 */
export function useApproveSummariesBatch() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (summaryIds: string[]) => commissionService.approveSummariesBatch(venueId!, summaryIds),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
		},
	})
}

/**
 * Hook for disputing a summary
 */
export function useDisputeSummary() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ summaryId, reason }: { summaryId: string; reason: string }) =>
			commissionService.disputeSummary(venueId!, summaryId, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
		},
	})
}

/**
 * Hook for adding bonus to a summary
 */
export function useAddBonus() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ summaryId, data }: { summaryId: string; data: AddBonusInput }) =>
			commissionService.addBonus(venueId!, summaryId, data),
		onSuccess: (_, { summaryId }) => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.summary(venueId, summaryId) })
		},
	})
}

/**
 * Hook for adding adjustment to a summary
 */
export function useAddAdjustment() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ summaryId, data }: { summaryId: string; data: AdjustSummaryInput }) =>
			commissionService.addAdjustment(venueId!, summaryId, data),
		onSuccess: (_, { summaryId }) => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.summary(venueId, summaryId) })
		},
	})
}

// ============================================
// PAYOUT HOOKS
// ============================================

/**
 * Hook for fetching payouts
 */
export function useCommissionPayouts(filters?: PayoutFilters) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.payouts(venueId), filters],
		queryFn: () => commissionService.getPayouts(venueId!, filters),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching a single payout
 */
export function useCommissionPayout(payoutId: string | undefined) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.payout(venueId, payoutId || ''),
		queryFn: () => commissionService.getPayout(venueId!, payoutId!),
		enabled: !!venueId && !!payoutId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching staff payouts
 */
export function useStaffPayouts(staffId: string | undefined, limit: number = 10) {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: [...commissionKeys.staffPayouts(venueId, staffId || ''), { limit }],
		queryFn: () => commissionService.getStaffPayouts(venueId!, staffId!, limit),
		enabled: !!venueId && !!staffId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for creating payouts
 */
export function useCreatePayouts() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreatePayoutInput) => commissionService.createPayouts(venueId!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.payouts(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
		},
	})
}

/**
 * Hook for approving a payout
 */
export function useApprovePayout() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (payoutId: string) => commissionService.approvePayout(venueId!, payoutId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.payouts(venueId) })
		},
	})
}

/**
 * Hook for processing a payout
 */
export function useProcessPayout() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (payoutId: string) => commissionService.processPayout(venueId!, payoutId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.payouts(venueId) })
		},
	})
}

/**
 * Hook for completing a payout
 */
export function useCompletePayout() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ payoutId, reference }: { payoutId: string; reference?: string }) =>
			commissionService.completePayout(venueId!, payoutId, reference),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.payouts(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.payoutStats(venueId) })
		},
	})
}

/**
 * Hook for canceling a payout
 */
export function useCancelPayout() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ payoutId, reason }: { payoutId: string; reason?: string }) =>
			commissionService.cancelPayout(venueId!, payoutId, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.payouts(venueId) })
		},
	})
}

// ============================================
// STATS HOOKS
// ============================================

/**
 * Hook for fetching commission stats
 */
export function useCommissionStats() {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.stats(venueId),
		queryFn: () => commissionService.getStats(venueId!),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

/**
 * Hook for fetching payout stats
 */
export function usePayoutStats() {
	const { venueId } = useCurrentVenue()

	return useQuery({
		queryKey: commissionKeys.payoutStats(venueId),
		queryFn: () => commissionService.getPayoutStats(venueId!),
		enabled: !!venueId,
		staleTime: 2 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	})
}

// ============================================
// CALCULATION TRIGGERS
// ============================================

/**
 * Hook for triggering commission calculation for a payment
 */
export function useCalculateCommission() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (paymentId: string) => commissionService.calculateForPayment(venueId!, paymentId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.calculations(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
		},
	})
}

/**
 * Hook for generating summaries
 */
export function useGenerateSummaries() {
	const { venueId } = useCurrentVenue()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
			commissionService.generateSummaries(venueId!, startDate, endDate),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: commissionKeys.summaries(venueId) })
			queryClient.invalidateQueries({ queryKey: commissionKeys.stats(venueId) })
		},
	})
}

export default {
	commissionKeys,
	useCommissionConfigs,
	useCommissionConfig,
	useCreateCommissionConfig,
	useUpdateCommissionConfig,
	useDeleteCommissionConfig,
	useCommissionTiers,
	useCreateCommissionTier,
	useCreateCommissionTiersBatch,
	useUpdateCommissionTier,
	useDeleteCommissionTier,
	useStaffTierProgress,
	useCommissionOverrides,
	useCreateCommissionOverride,
	useUpdateCommissionOverride,
	useDeleteCommissionOverride,
	useStaffCommissions,
	useMyCommissions,
	useCommissionCalculations,
	useCommissionSummaries,
	useCommissionSummary,
	usePendingCommissionSummaries,
	useApproveSummary,
	useApproveSummariesBatch,
	useDisputeSummary,
	useAddBonus,
	useAddAdjustment,
	useCommissionPayouts,
	useCommissionPayout,
	useStaffPayouts,
	useCreatePayouts,
	useApprovePayout,
	useProcessPayout,
	useCompletePayout,
	useCancelPayout,
	useCommissionStats,
	usePayoutStats,
	useCalculateCommission,
	useGenerateSummaries,
}
