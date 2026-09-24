import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LoadingScreen } from '@/components/spinner'
import { useToast } from '@/hooks/use-toast'
import * as authService from '@/services/auth.service'
import { clearInviteToken, resolvePostLoginRedirect } from '@/lib/pendingInvitation'
import { tomarIntentoDeAltaGoogle } from '@/lib/googleSignupIntent'
import { trackSignup } from '@/lib/gtag'

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
      // 🔴 El intento del ALTA se toma (y se borra) al entrar: si esta vuelta de Google venía de
      // «Continuar con Google» en /signup, el servidor tiene que saberlo para crear el negocio con
      // la campaña del anuncio. Y cualquier fallo regresa al alta, no al login.
      const intentoDeAlta = tomarIntentoDeAltaGoogle()
      const paginaDeRegreso = intentoDeAlta ? '/signup' : '/login'

      if (error) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: t('auth.google.cancelled'),
        })
        navigate(paginaDeRegreso, { replace: true })
        return
      }

      if (!code) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: t('auth.google.codeNotFound'),
        })
        navigate(paginaDeRegreso, { replace: true })
        return
      }

      try {
        const result = await authService.googleOAuthCallback(code, intentoDeAlta ?? undefined)

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

        // Alta NUEVA desde /signup: la conversión del anuncio (GA4 `sign_up`, igual que el alta por
        // correo) y directo al asistente. Una cuenta que ya existía sólo inicia sesión: contarla
        // como alta inflaría las conversiones del anuncio.
        const altaNueva = !!intentoDeAlta && isNewUser === true
        if (altaNueva) trackSignup('google', intentoDeAlta?.launchCampaignCode)

        navigate(inviteRedirect ?? (altaNueva ? '/setup' : '/'), { replace: true })
      } catch (error: any) {
        clearInviteToken()
        toast({
          title: t('auth.google.error'),
          variant: 'destructive',
          description: error.response?.data?.message || t('auth.google.genericError'),
        })
        navigate(paginaDeRegreso, { replace: true })
      }
    }

    handleCallback()
  }, [searchParams, navigate, queryClient, toast, t])

  return <LoadingScreen message={t('auth.google.authenticating')} />
}

export default GoogleOAuthCallback
