import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'

interface EmailVerificationFormProps {
  email: string
}

export function EmailVerificationForm({ email }: EmailVerificationFormProps) {
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
        type: 'active'
      })

      toast({
        title: t('verification.successTitle'),
        description: t('verification.successDescription'),
      })
      navigate('/onboarding')
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
  }

  const handleVerify = () => {
    if (code.length === 4) {
      verifyMutation.mutate(code)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t('verification.title')}</h1>
        <p className="text-muted-foreground text-sm text-balance">
          {t('verification.subtitle')} <strong>{email}</strong>
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <InputOTP maxLength={4} value={code} onChange={setCode} onComplete={handleComplete}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>

        <p className="text-muted-foreground text-xs text-center">{t('verification.expiryInfo')}</p>

        <Button onClick={handleVerify} className="w-full" disabled={code.length !== 4 || verifyMutation.isPending}>
          {verifyMutation.isPending && <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />}
          {t('verification.verifyButton')}
        </Button>
      </div>

      <div className="text-center text-sm text-muted-foreground">{t('verification.didntReceive')}</div>
    </div>
  )
}
