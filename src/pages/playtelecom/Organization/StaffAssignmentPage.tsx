import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

export default function StaffAssignmentPage() {
  return (
    <div className="space-y-6">
      <PageTitleWithInfo title="Asignación de Personal" />
      <GlassCard className="p-8 text-center">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h3 className="text-lg font-semibold mb-2">Asignación de Personal a Tiendas</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Reasigna promotores y supervisores entre tiendas de forma ágil.
        </p>
        <Badge variant="outline">Muy pronto</Badge>
      </GlassCard>
    </div>
  )
}
