import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import * as authService from '@/services/auth.service'
import { clearInviteToken, resolvePostLoginRedirect } from '@/lib/pendingInvitation'

const GoogleOAuthCallback: React.FC = () => {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: t('auth.google.cancelled'),
        })
        navigate('/login', { replace: true })
        return
      }

      if (!code) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: t('auth.google.codeNotFound'),
        })
        navigate('/login', { replace: true })
        return
      }

      try {
        const result = await authService.googleOAuthCallback(code)

        // SECURITY: Use refetchQueries to wait for auth state before navigating
        // invalidateQueries doesn't wait - causes race condition on slow networks
        await queryClient.refetchQueries({ queryKey: ['status'] })

        const isNewUser = result?.isNewUser
        toast({
          title: result?.message || t('auth.google.success'),
          description: isNewUser ? t('auth.google.welcomeNewUser') : undefined,
        })

        // An invitation still waiting on this person must win over the normal landing page.
        // The email/password path has always done this (AuthContext's login mutation); Google
        // dropped it, so anyone whose ONLY access was a pending invitation signed in successfully
        // and landed on an empty dashboard with no way to reach the invitation.
        const inviteRedirect = resolvePostLoginRedirect({
          pendingInvitations: result?.pendingInvitations,
          isNewUser,
        })

        navigate(inviteRedirect ?? '/', { replace: true })
      } catch (error: any) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: error.response?.data?.message || t('auth.google.genericError'),
        })
        navigate('/login', { replace: true })
      }
    }

    handleCallback()
  }, [searchParams, navigate, queryClient, toast, t])

  return <LoadingScreen message={t('auth.google.authenticating')} />
}

export default GoogleOAuthCallback
