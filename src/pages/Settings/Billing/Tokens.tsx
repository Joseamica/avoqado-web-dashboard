import { useCurrentVenue } from '@/hooks/use-current-venue'
import { TokenBudgetSection } from '../components/TokenBudgetSection'

export default function Tokens() {
  const { venueId } = useCurrentVenue()

  return (
    <div className="px-8 pt-6">
      <TokenBudgetSection venueId={venueId} />
    </div>
  )
}
