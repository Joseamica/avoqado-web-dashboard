import api from '@/api'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface EmailVerificationFormProps {
  email: string
  /** V2 wizard users redirect to /setup instead of /onboarding */
  wizardVersion?: number
}

export function EmailVerificationForm({ email, wizardVersion }: EmailVerificationFormProps) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')

  const verifyMutation = useMutation({
    mutationFn: async (verificationCode: string) => {
      const response = await api.post('/api/v1/onboarding/verify-email', {
        email,
        verificationCode,
      })
      return response.data
    },
    onSuccess: async () => {
      // Force refetch auth status to get updated emailVerified: true
      // Use refetchQueries instead of invalidateQueries to bypass HTTP cache (304)
      await queryClient.refetchQueries({
        queryKey: ['status'],
        type: 'active',
      })

      toast({
        title: t('verification.successTitle'),
        description: t('verification.successDescription'),
      })

      // Check if user is still authenticated after refetch
      const statusData = queryClient.getQueryData(['status']) as any

      if (statusData?.authenticated) {
        // User is logged in, proceed to setup (v2) or onboarding (v1/legacy)
        const destination = wizardVersion === 2 ? '/setup' : '/onboarding'
        navigate(destination)
      } else {
        // User session expired, redirect to login with success message
        navigate(`/login?verified=true&email=${encodeURIComponent(email)}`)
      }
    },
    onError: (error: any) => {
      toast({
        title: t('verification.errorTitle'),
        description: error.response?.data?.message || t('verification.errorDescription'),
        variant: 'destructive',
      })
    },
  })

  const handleComplete = (value: string) => {
    setCode(value)
    // FAANG Pattern: Auto-verify when 6 digits are complete
    if (value.length === 6) {
      verifyMutation.mutate(value)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* OTP Input - Larger and more prominent */}
      <div className="px-4">
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={handleComplete}>
          <InputOTPGroup className="gap-3">
            <InputOTPSlot index={0} className="w-16 h-16 text-2xl rounded-lg border-2" />
            <InputOTPSlot index={1} className="w-16 h-16 text-2xl rounded-lg border-2" />
            <InputOTPSlot index={2} className="w-16 h-16 text-2xl rounded-lg border-2" />
            <InputOTPSlot index={3} className="w-16 h-16 text-2xl rounded-lg border-2" />
            <InputOTPSlot index={4} className="w-16 h-16 text-2xl rounded-lg border-2" />
            <InputOTPSlot index={5} className="w-16 h-16 text-2xl rounded-lg border-2" />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {/* Subtle expiry notice */}
      <p className="text-muted-foreground text-xs">{t('verification.expiryInfo')}</p>
    </div>
  )
}
