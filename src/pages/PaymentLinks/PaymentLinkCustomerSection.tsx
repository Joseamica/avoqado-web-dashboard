import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAccess } from '@/hooks/use-access'
import { useDebounce } from '@/hooks/useDebounce'
import customerService from '@/services/customer.service'
import type { PaymentLinkCustomer } from '@/services/paymentLink.service'
import { CountryCodePicker, DEFAULT_COUNTRY, type Country } from './CountryCodePicker'
import { customerPhoneNumber } from './stored-customer-phone'

interface Props {
  venueId: string
  selected: PaymentLinkCustomer | null
  onChange: (customer: PaymentLinkCustomer | null) => void
  readOnly?: boolean
  /** Editar una liga sin cliente: se puede agregar uno, pero sólo cuenta de aquí en adelante. */
  addingLater?: boolean
  reusable: boolean
  onBusyChange: (busy: boolean) => void
}

export function PaymentLinkCustomerSection({ venueId, selected, onChange, readOnly, addingLater, reusable, onBusyChange }: Props) {
  const { t } = useTranslation('paymentLinks')
  const { can } = useAccess()
  const queryClient = useQueryClient()
  const canRead = can('customers:read')
  const canCreate = canRead && can('customers:create')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [newCustomer, setNewCustomer] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const customers = useQuery({
    queryKey: ['customers', venueId, 'payment-link-picker', debouncedSearch, page],
    queryFn: () => customerService.getCustomers(venueId, { page, pageSize: 20, search: debouncedSearch }),
    enabled: !!venueId && canRead && !readOnly,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  async function saveCustomer() {
    if (inFlight.current || !canCreate) return
    const fullPhone = phone.trim() ? customerPhoneNumber(phone, country) : null
    const data = {
      ...(name.trim() ? { firstName: name.trim() } : {}),
      ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
      ...(fullPhone ? { phone: fullPhone } : {}),
    }
    if (
      (!data.email && !data.phone) ||
      (data.email && !z.string().email().safeParse(data.email).success) ||
      (phone.trim() && !fullPhone) ||
      name.trim().length > 50
    ) {
      setError('customer.invalidContact')
      return
    }
    inFlight.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      const result = await customerService.createCustomer(venueId, data)
      queryClient.invalidateQueries({ queryKey: ['customers', venueId] })
      queryClient.invalidateQueries({ queryKey: ['customers-pending-balance-count', venueId] })
      if (!alive.current) return
      onChange(result.customer)
      setNewCustomer(false)
    } catch (err) {
      if (!alive.current) return
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === undefined || status === 400 || status === 409) {
        try {
          const matches = await customerService.getCustomers(venueId, { page: 1, pageSize: 20, search: data.email || data.phone })
          if (!alive.current) return
          const exact = matches.data.filter(
            c =>
              c.active === true &&
              (!data.email || c.email?.trim().toLowerCase() === data.email) &&
              (!data.phone || c.phone?.replace(/\D/g, '') === data.phone.replace(/\D/g, '')),
          )
          // A truncated page cannot prove uniqueness. Ask the operator instead.
          if (exact.length === 1 && !matches.meta.searchCapped && matches.meta.totalCount <= matches.data.length) {
            onChange(exact[0])
            setNewCustomer(false)
            return
          }
          setSearch(data.email || data.phone || '')
          setPage(1)
          setError('customer.chooseExisting')
        } catch {
          if (alive.current) setError('customer.createFailed')
        }
      } else {
        setError('customer.createFailed')
      }
    } finally {
      inFlight.current = false
      if (alive.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-input bg-card p-6" data-tour="payment-link-customer">
      <h2 className="text-lg font-semibold">{t('customer.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('customer.hint')}</p>
      {addingLater && canRead && <p className="text-sm text-muted-foreground">{t('customer.addLater')}</p>}
      {!canRead ? (
        <p className="text-sm text-muted-foreground">{t('customer.noReadPermission')}</p>
      ) : (
        <>
          {selected && (
            <div className="space-y-1 rounded-lg bg-muted p-3" data-testid="selected-customer">
              <p className="font-medium">
                {[selected.firstName, selected.lastName].filter(Boolean).join(' ') || selected.email || selected.phone}
              </p>
              <p className="text-sm text-muted-foreground">{[selected.email, selected.phone].filter(Boolean).join(' · ')}</p>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
                  {t('customer.remove')}
                </Button>
              )}
            </div>
          )}
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{t(selected ? 'customer.readOnly' : 'customer.none')}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="pl-customer-search">{t('customer.search')}</Label>
                <Input
                  id="pl-customer-search"
                  data-tour="payment-link-customer-search"
                  disabled={busy}
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="h-12 text-base"
                />
              </div>
              <div aria-live="polite" aria-busy={customers.isFetching} className="space-y-2">
                {customers.isError ? (
                  <div role="alert">
                    <p>{t('customer.loadFailed')}</p>
                    <Button type="button" variant="outline" onClick={() => customers.refetch()}>
                      {t('customer.retry')}
                    </Button>
                  </div>
                ) : customers.isPending ? (
                  <p>{t('customer.loading')}</p>
                ) : (
                  <>
                    {customers.data?.data.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t(debouncedSearch ? 'customer.noResults' : 'customer.empty')}</p>
                    )}
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {customers.data?.data.map(customer => (
                        <Button
                          key={customer.id}
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-start whitespace-normal p-3 text-left"
                          disabled={busy || customer.active !== true || customers.isPlaceholderData}
                          aria-pressed={selected?.id === customer.id}
                          onClick={() => {
                            onChange(customer)
                            setError('')
                            setNewCustomer(false)
                          }}
                        >
                          <span>
                            <span className="block font-medium">
                              {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email || customer.phone}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {[customer.email, customer.phone].filter(Boolean).join(' · ')}
                              {customer.active !== true && ` · ${t('customer.inactive')}`}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        {t('customer.total', {
                          count: customers.data?.meta.totalMatches ?? customers.data?.meta.totalCount ?? 0,
                          page,
                          pages: Math.max(1, customers.data?.meta.totalPages ?? 1),
                        })}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || page <= 1 || customers.isFetching}
                          onClick={() => setPage(p => p - 1)}
                        >
                          {t('customer.previous')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || !customers.data?.meta.hasNextPage || customers.isFetching}
                          onClick={() => setPage(p => p + 1)}
                        >
                          {t('customer.next')}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {customers.data?.meta.searchCapped && (
                <p className="text-sm text-muted-foreground">{t('customer.searchCapped', { count: customers.data.meta.totalCount })}</p>
              )}
              {canCreate ? (
                <Button
                  type="button"
                  variant="outline"
                  data-tour="payment-link-customer-new"
                  disabled={busy}
                  onClick={() => setNewCustomer(!newCustomer)}
                >
                  {t(newCustomer ? 'customer.cancelNew' : 'customer.new')}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{t('customer.noCreatePermission')}</p>
              )}
              {newCustomer && (
                <fieldset disabled={busy} className="space-y-3" data-tour="payment-link-customer-create">
                  <div>
                    <Label htmlFor="pl-customer-name">{t('customer.name')}</Label>
                    <Input
                      id="pl-customer-name"
                      data-tour="payment-link-customer-name"
                      maxLength={50}
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pl-customer-email">{t('customer.email')}</Label>
                    <Input
                      id="pl-customer-email"
                      data-tour="payment-link-customer-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pl-customer-phone">{t('customer.phone')}</Label>
                    <div className="flex gap-2">
                      <CountryCodePicker value={country} onChange={setCountry} disabled={busy} />
                      <Input
                        id="pl-customer-phone"
                        data-tour="payment-link-customer-phone"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="button" data-tour="payment-link-customer-save" onClick={saveCustomer} disabled={busy}>
                    {t(busy ? 'customer.saving' : 'customer.save')}
                  </Button>
                </fieldset>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {t(error)}
                </p>
              )}
            </>
          )}
          {selected && reusable && <p className="text-sm text-muted-foreground">{t('customer.reusableWarning')}</p>}
        </>
      )}
      <p className="text-xs text-muted-foreground">{t('customer.onlineOnly')}</p>
    </section>
  )
}
