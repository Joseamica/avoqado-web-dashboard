import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

import { getMenuCategories, getProducts } from '@/services/menu.service'
import customerService from '@/services/customer.service'

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6]

export function useDiscountFormData(venueId: string | undefined) {
  const { t } = useTranslation('promotions')

  // Fetch products for selector
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    enabled: !!venueId,
  })

  // Fetch categories for selector
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId,
  })

  // Fetch customer groups for selector
  const { data: customerGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['customer-groups', venueId],
    queryFn: () => customerService.getCustomerGroups(venueId, { pageSize: 100 }),
    enabled: !!venueId,
  })

  // Transform options for MultipleSelector
  const productOptions = useMemo(() => {
    return (products || []).map((p: any) => ({
      value: p.id,
      label: p.name,
    }))
  }, [products])

  const categoryOptions = useMemo(() => {
    return (categories || []).map((c: any) => ({
      value: c.id,
      label: c.name,
    }))
  }, [categories])

  const customerGroupOptions = useMemo(() => {
    return (customerGroups?.data || []).map((g: any) => ({
      value: g.id,
      label: g.name,
    }))
  }, [customerGroups])

  const dayOptions = useMemo(() => {
    return DAYS_OF_WEEK.map(day => ({
      value: day.toString(),
      label: t(`discounts.form.days.${day}`),
    }))
  }, [t])

  return {
    productOptions,
    categoryOptions,
    customerGroupOptions,
    dayOptions,
    isLoading: isLoadingProducts || isLoadingCategories || isLoadingGroups,
  }
}
