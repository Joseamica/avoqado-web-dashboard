import { useCurrentVenue } from '@/hooks/use-current-venue'
import { PaymentMethodsSection } from '../components/PaymentMethodsSection'

export default function PaymentMethods() {
  const { venueId } = useCurrentVenue()

  return (
    <div className="px-8 pt-6">
      <PaymentMethodsSection venueId={venueId} />
    </div>
  )
}
