import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { DashboardProgressiveService } from '@/services/dashboard.progressive.service'
import { getLast7Days, getToday, getYesterday, getLast30Days, getPreviousPeriod } from '@/utils/datetime'

// Type for comparison period
export type ComparisonPeriod = 'day' | 'week' | 'month' | 'custom' | ''

export const useDashboardData = () => {
  const { t } = useTranslation('home')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()

  // Get venue timezone for date calculations
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  const [compareType, setCompareType] = useState<ComparisonPeriod>('')
  const [comparisonLabel, setComparisonLabel] = useState(t('comparison.previousPeriod'))
  const [activeFilter, setActiveFilter] = useState('7days')

  // Define ranges using venue timezone
  const [selectedRange, setSelectedRange] = useState(() => {
    const range = getLast7Days(venueTimezone)
    return range
  })

  const [compareRange, setCompareRange] = useState(() => {
    const range = getLast7Days(venueTimezone)
    return getPreviousPeriod(range)
  })

  // Initialize progressive loading service
  const dashboardService = useMemo(() => new DashboardProgressiveService(venueId), [venueId])

  // Handler for "Today" filter
  const handleToday = useCallback(() => {
    const todayRange = getToday(venueTimezone)
    const yesterdayRange = getYesterday(venueTimezone)

    setSelectedRange(todayRange)
    setCompareRange(yesterdayRange)
    setCompareType('day')
    setComparisonLabel(t('comparison.yesterday'))
    setActiveFilter('today')
  }, [t, venueTimezone])

  // Handler for "Last 7 days" filter
  const handleLast7Days = useCallback(() => {
    const range = getLast7Days(venueTimezone)
    const prevRange = getPreviousPeriod(range)

    setSelectedRange(range)
    setCompareRange(prevRange)
    setCompareType('week')
    setComparisonLabel(t('comparison.prev7days'))
    setActiveFilter('7days')
  }, [t, venueTimezone])

  // Handler for "Last 30 days" filter
  const handleLast30Days = useCallback(() => {
    const range = getLast30Days(venueTimezone)
    const prevRange = getPreviousPeriod(range)

    setSelectedRange(range)
    setCompareRange(prevRange)
    setCompareType('month')
    setComparisonLabel(t('comparison.prev30days'))
    setActiveFilter('30days')
  }, [t, venueTimezone])

  // Basic metrics query (priority load)
  const {
    data: basicData,
    isLoading: isBasicLoading,
    isError: isBasicError,
    error: basicError,
    refetch: refetchBasicData,
  } = useQuery({
    queryKey: ['basic_metrics', venueId, selectedRange.from.toISOString(), selectedRange.to.toISOString()],
    queryFn: async () => {
      return await dashboardService.getBasicMetrics(selectedRange)
    },
    staleTime: 0,
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  })

  // Comparison data query
  const {
    data: compareData,
    isLoading: isCompareLoading,
    refetch: refetchCompareData,
  } = useQuery({
    queryKey: ['basic_metrics_compare', venueId, compareRange.from.toISOString(), compareRange.to.toISOString()],
    queryFn: async () => {
      if (!compareType) return null
      return await dashboardService.getBasicMetrics(compareRange)
    },
    staleTime: 0,
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: !!compareType,
  })

  // Register socket event handlers
  useSocketEvents(
    venueId,
    data => {
      console.log('Received payment update:', data)
      refetchBasicData()
    },
    data => {
      console.log('Received shift update:', data)
      refetchBasicData()
    },
  )

  // Extract the basic data we need
  const filteredReviews = useMemo(() => basicData?.reviews || [], [basicData?.reviews])

  // Filter out payments from cancelled orders - these should not count towards total sales
  const filteredPayments = useMemo(() => {
    const payments = basicData?.payments || []
    return payments.filter((payment: any) => {
      // Exclude if the payment's order is cancelled
      const orderStatus = payment.order?.status || payment.orderStatus
      if (orderStatus === 'CANCELLED') return false
      return true
    })
  }, [basicData?.payments])

  const paymentMethodsData = useMemo(() => basicData?.paymentMethodsData || [], [basicData?.paymentMethodsData])

  const fiveStarReviews = useMemo(() => {
    return filteredReviews.filter((review: any) => review.stars === 5).length
  }, [filteredReviews])

  // Calculate total amount from payments
  const amount = useMemo(() => {
    return filteredPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
  }, [filteredPayments])

  const totalAmount = filteredPayments.length > 0 ? amount : 0

  // Calculate tip-related metrics
  const tipStats = useMemo(() => {
    if (!filteredPayments?.length) return { totalTips: 0, avgTipPercentage: 0 }

    const paymentsWithTips = filteredPayments.filter((payment: any) => payment.tips && payment.tips.length > 0)

    const totalTips = paymentsWithTips.reduce((sum: number, payment: any) => {
      const tipsSum = payment.tips.reduce((tipSum: number, tip: any) => tipSum + Number(tip.amount), 0)
      return sum + tipsSum
    }, 0)

    let avgTipPercentage = 0
    if (paymentsWithTips.length > 0) {
      const tipPercentages = paymentsWithTips.map((payment: any) => {
        const paymentAmount = Number(payment.amount)
        const tipsTotal = payment.tips.reduce((tipSum: number, tip: any) => tipSum + Number(tip.amount), 0)
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum: number, percentage: number) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: (avgTipPercentage || 0).toFixed(1),
    }
  }, [filteredPayments])

  // Process comparison data
  const compareReviews = useMemo(() => compareData?.reviews || [], [compareData?.reviews])
  const compareFiveStarReviews = useMemo(() => {
    return compareReviews.filter((review: any) => review.stars === 5).length
  }, [compareReviews])

  // Filter out payments from cancelled orders in comparison data too
  const comparePayments = useMemo(() => {
    const payments = compareData?.payments || []
    return payments.filter((payment: any) => {
      const orderStatus = payment.order?.status || payment.orderStatus
      if (orderStatus === 'CANCELLED') return false
      return true
    })
  }, [compareData?.payments])
  const compareAmount = useMemo(() => {
    return comparePayments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
  }, [comparePayments])

  const compareTipStats = useMemo(() => {
    if (!comparePayments?.length) return { totalTips: 0, avgTipPercentage: '0' }

    const paymentsWithTips = comparePayments.filter((payment: any) => payment.tips && payment.tips.length > 0)

    const totalTips = paymentsWithTips.reduce((sum: number, payment: any) => {
      const tipsSum = payment.tips.reduce((tipSum: number, tip: any) => tipSum + Number(tip.amount), 0)
      return sum + tipsSum
    }, 0)

    let avgTipPercentage = 0
    if (paymentsWithTips.length > 0) {
      const tipPercentages = paymentsWithTips.map((payment: any) => {
        const paymentAmount = Number(payment.amount)
        const tipsTotal = payment.tips.reduce((tipSum: number, tip: any) => tipSum + Number(tip.amount), 0)
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum: number, percentage: number) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: (avgTipPercentage || 0).toFixed(1),
    }
  }, [comparePayments])

  // Calculate comparison percentages
  const getComparisonPercentage = (currentValue: number, previousValue: number): number => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0
    return Math.round(((currentValue - previousValue) / previousValue) * 100)
  }

  const amountChangePercentage = useMemo(() => {
    return getComparisonPercentage(totalAmount, compareAmount)
  }, [totalAmount, compareAmount])

  const reviewsChangePercentage = useMemo(() => {
    return getComparisonPercentage(fiveStarReviews, compareFiveStarReviews)
  }, [fiveStarReviews, compareFiveStarReviews])

  const tipsChangePercentage = useMemo(() => {
    return getComparisonPercentage(tipStats.totalTips, compareTipStats.totalTips)
  }, [tipStats.totalTips, compareTipStats.totalTips])

  const tipAvgChangePercentage = useMemo(() => {
    return getComparisonPercentage(parseFloat(String(tipStats.avgTipPercentage)), parseFloat(String(compareTipStats.avgTipPercentage)))
  }, [tipStats.avgTipPercentage, compareTipStats.avgTipPercentage])

  return {
    venueId,
    activeVenue,
    selectedRange,
    setSelectedRange,
    compareRange,
    setCompareRange,
    compareType,
    setCompareType,
    comparisonLabel,
    setComparisonLabel,
    activeFilter,
    setActiveFilter,
    handleToday,
    handleLast7Days,
    handleLast30Days,
    basicData,
    isBasicLoading,
    isBasicError,
    basicError,
    refetchBasicData,
    refetchCompareData,
    isCompareLoading,
    totalAmount,
    fiveStarReviews,
    tipStats,
    paymentMethodsData,
    amountChangePercentage,
    reviewsChangePercentage,
    tipsChangePercentage,
    tipAvgChangePercentage,
    filteredPayments,
    filteredReviews,
    compareAmount,
    compareFiveStarReviews,
    compareTipStats,
  }
}
