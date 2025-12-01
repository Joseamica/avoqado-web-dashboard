import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Currency } from '@/utils/currency'
import { ComparisonPeriod } from './useDashboardData'

interface UseDashboardExportProps {
  venueId: string
  selectedRange: { from: Date; to: Date }
  basicData: any
  filteredPayments: any[]
  filteredReviews: any[]
  paymentMethodsData: any[]
  totalAmount: number
  fiveStarReviews: number
  tipStats: { totalTips: number; avgTipPercentage: number | string }
  compareType: ComparisonPeriod
  comparisonLabel: string
  compareAmount: number
  compareFiveStarReviews: number
  compareTipStats: { totalTips: number; avgTipPercentage: number | string }
  amountChangePercentage: number
  reviewsChangePercentage: number
  tipsChangePercentage: number
  tipAvgChangePercentage: number
}

export const useDashboardExport = ({
  venueId,
  selectedRange,
  basicData,
  filteredPayments,
  filteredReviews,
  paymentMethodsData,
  totalAmount,
  fiveStarReviews,
  tipStats,
  compareType,
  comparisonLabel,
  compareAmount,
  compareFiveStarReviews,
  compareTipStats,
  amountChangePercentage,
  reviewsChangePercentage,
  tipsChangePercentage,
  tipAvgChangePercentage,
}: UseDashboardExportProps) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)
  const [exportLoading, setExportLoading] = useState(false)

  // Helper function to convert data to CSV
  const convertToCSV = (data: any[], headers: string[]): string => {
    const csvHeaders = headers.join(',')
    const csvRows = data.map(row =>
      headers
        .map(header => {
          const value = row[header] ?? ''
          // Escape commas and quotes in values
          const stringValue = String(value).replace(/"/g, '""')
          return `"${stringValue}"`
        })
        .join(','),
    )
    return [csvHeaders, ...csvRows].join('\n')
  }

  const exportToCSV = useCallback(async () => {
    if (!basicData) return

    setExportLoading(true)
    try {
      // Prepare payment data for CSV
      const paymentsForCSV = filteredPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        source: payment.source || '',
        cardBrand: payment.cardBrand || '',
        maskedPan: payment.maskedPan || '',
        createdAt: new Date(payment.createdAt).toLocaleDateString(localeCode),
        tips: payment.tips?.reduce((sum: number, tip: any) => sum + Number(tip.amount), 0) || 0,
        status: payment.status,
      }))

      // Prepare reviews data for CSV
      const reviewsForCSV = filteredReviews.map(review => ({
        id: review.id,
        stars: review.stars,
        comment: review.comment || '',
        createdAt: new Date(review.createdAt).toLocaleDateString(localeCode),
        customerName: review.customerName || '',
      }))

      // Prepare payment methods summary for CSV
      const paymentMethodsForCSV = paymentMethodsData.map(method => ({
        method: method.method,
        total: method.total,
        count: method.count || 0,
      }))

      // Create CSV content
      const paymentsCSV = convertToCSV(paymentsForCSV, [
        'id',
        'amount',
        'method',
        'source',
        'cardBrand',
        'maskedPan',
        'createdAt',
        'tips',
        'status',
      ])

      const reviewsCSV = convertToCSV(reviewsForCSV, ['id', 'stars', 'comment', 'createdAt', 'customerName'])

      const paymentMethodsCSV = convertToCSV(paymentMethodsForCSV, ['method', 'total', 'count'])

      // Combine all data with section headers
      const combinedCSV = [
        '# ' + t('export.payments'),
        paymentsCSV,
        '',
        '# ' + t('export.reviews'),
        reviewsCSV,
        '',
        '# ' + t('export.paymentMethods'),
        paymentMethodsCSV,
        '',
        '# ' + t('export.summary'),
        `"${t('cards.totalSales')}","${Currency(totalAmount)}"`,
        `"${t('cards.fiveStars')}","${fiveStarReviews}"`,
        `"${t('cards.totalTips')}","${Currency(tipStats.totalTips)}"`,
        `"${t('cards.avgTipPercentage')}","${tipStats.avgTipPercentage}%"`,
      ].join('\n')

      // Create and download file
      const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `dashboard-data-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export to CSV failed:', error)
    } finally {
      setExportLoading(false)
    }
  }, [basicData, filteredPayments, filteredReviews, paymentMethodsData, totalAmount, fiveStarReviews, tipStats, t, localeCode])

  const exportToJSON = useCallback(async () => {
    if (!basicData) return

    setExportLoading(true)
    try {
      // Prepare comprehensive data for JSON export
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          dateRange: {
            from: selectedRange.from.toISOString(),
            to: selectedRange.to.toISOString(),
          },
          venue: venueId,
          locale: i18n.language,
        },
        summary: {
          totalSales: totalAmount,
          fiveStarReviews,
          totalTips: tipStats.totalTips,
          avgTipPercentage: parseFloat(String(tipStats.avgTipPercentage)),
          totalPayments: filteredPayments.length,
          totalReviews: filteredReviews.length,
        },
        payments: filteredPayments.map(payment => ({
          ...payment,
          tips: payment.tips?.reduce((sum: number, tip: any) => sum + Number(tip.amount), 0) || 0,
          createdAt: new Date(payment.createdAt).toISOString(),
        })),
        reviews: filteredReviews.map(review => ({
          ...review,
          createdAt: new Date(review.createdAt).toISOString(),
        })),
        paymentMethods: paymentMethodsData,
        comparison: compareType
          ? {
              type: compareType,
              label: comparisonLabel,
              data: {
                totalSales: compareAmount,
                fiveStarReviews: compareFiveStarReviews,
                totalTips: compareTipStats.totalTips,
                avgTipPercentage: parseFloat(String(compareTipStats.avgTipPercentage)),
              },
              percentageChanges: {
                sales: amountChangePercentage,
                reviews: reviewsChangePercentage,
                tips: tipsChangePercentage,
                avgTipPercentage: tipAvgChangePercentage,
              },
            }
          : null,
      }

      // Create and download file
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `dashboard-data-${format(new Date(), 'yyyy-MM-dd')}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export to JSON failed:', error)
    } finally {
      setExportLoading(false)
    }
  }, [
    basicData,
    filteredPayments,
    filteredReviews,
    paymentMethodsData,
    totalAmount,
    fiveStarReviews,
    tipStats,
    selectedRange,
    venueId,
    i18n.language,
    compareType,
    comparisonLabel,
    compareAmount,
    compareFiveStarReviews,
    compareTipStats,
    amountChangePercentage,
    reviewsChangePercentage,
    tipsChangePercentage,
    tipAvgChangePercentage,
  ])

  return {
    exportLoading,
    exportToCSV,
    exportToJSON,
  }
}
