import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BasicPlanCard } from '../BasicPlanCard'
import type { PublicBasicPlan } from '@/services/hybridBilling.service'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => `${k}${o?.price ? `:${o.price}` : ''}${o?.count != null ? `:${o.count}` : ''}` }),
}))

const PLAN: PublicBasicPlan = {
  slug: 'plan-basico',
  name: 'Plan Básico',
  priceWithTax: '578.84',
  priceWithoutTax: '499.00',
  featureCodes: ['INVENTORY_TRACKING', 'KITCHEN_DISPLAY'],
  seatCap: null,
  trialDays: 30,
  publicationId: 'pub_1',
}

describe('BasicPlanCard', () => {
  it('precio SIN IVA grande y «+ IVA» en chico; nunca el total', () => {
    render(<BasicPlanCard plan={PLAN} selected={false} onSelect={() => {}} />)
    expect(screen.getByText('$499')).toBeInTheDocument()
    expect(screen.queryByText(/578/)).not.toBeInTheDocument()
    expect(screen.getByText('plan.perMonth · plan.plusIva')).toBeInTheDocument()
    expect(screen.getByText('plan.basic.trialCopy:$499')).toBeInTheDocument()
  })

  it('lista las funciones por nombre y dice «usuarios sin tope» sin seatCap', () => {
    render(<BasicPlanCard plan={PLAN} selected={false} onSelect={() => {}} />)
    expect(screen.getByText('hybrid.featureNames.KITCHEN_DISPLAY')).toBeInTheDocument()
    expect(screen.getByText('plan.basic.seatsUnlimited')).toBeInTheDocument()
  })

  it('con seatCap dice «hasta N usuarios»', () => {
    render(<BasicPlanCard plan={{ ...PLAN, seatCap: 3 }} selected={false} onSelect={() => {}} />)
    expect(screen.getByText('plan.basic.seatsCapped:3')).toBeInTheDocument()
  })

  it('es un radio: clic y Enter eligen; apagada no elige', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<BasicPlanCard plan={PLAN} selected onSelect={onSelect} />)
    const radio = screen.getByRole('radio')
    expect(radio).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(radio)
    fireEvent.keyDown(radio, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(2)
    rerender(<BasicPlanCard plan={PLAN} selected={false} disabled onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('radio'))
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})
