import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { StaffRole } from '@/types'

const SuperadminBanner: React.FC = () => {
  const { user } = useAuth()
  const { venue } = useCurrentVenue()
  const navigate = useNavigate()

  // Only show when superadmin is viewing a specific venue
  if (user?.role !== StaffRole.SUPERADMIN || !venue) return null

  return (
    <div className="bg-gradient-to-r from-amber-400 to-pink-500 px-4 py-2 flex items-center justify-between text-primary-foreground">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4" />
        <span className="text-sm font-medium">
          Viendo como: <strong>{venue.name}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/superadmin-v2')}
        className="text-primary-foreground hover:bg-primary-foreground/20 h-7 gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="text-sm">Volver a Superadmin</span>
      </Button>
    </div>
  )
}

export default SuperadminBanner
