import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'

// Schema will be created inside the component to access t() function
const createAcceptInvitationSchema = (t: any) =>
  z
    .object({
      firstName: z.string().min(1, t('inviteAccept.validation.firstNameRequired')).max(50, t('inviteAccept.validation.firstNameMax')),
      lastName: z.string().min(1, t('inviteAccept.validation.lastNameRequired')).max(50, t('inviteAccept.validation.lastNameMax')),
      password: z.string().min(8, t('inviteAccept.validation.passwordMin')),
      confirmPassword: z.string(),
      pin: z
        .string()
        .regex(/^\d{4}$/, t('inviteAccept.validation.pinFormat'))
        .optional()
        .or(z.literal('')),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: t('inviteAccept.validation.passwordMatch'),
      path: ['confirmPassword'],
    })

type AcceptInvitationFormData = {
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  pin?: string
}

interface InvitationDetails {
  id: string
  email: string
  role: string
  organizationName: string
  venueName: string
  inviterName: string
  expiresAt: string
  status: string
}

export default function InviteAccept() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null)
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(createAcceptInvitationSchema(t)),
    mode: 'onChange',
  })

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setInvitationError(t('inviteAccept.errors.invalidToken'))
      setIsLoadingInvitation(false)
      return
    }

    const fetchInvitationDetails = async () => {
      try {
        const response = await api.get(`/api/v1/invitations/${token}`)
        setInvitationDetails(response.data)
      } catch (error: any) {
        if (error.response?.status === 404) {
          setInvitationError(t('inviteAccept.errors.notFound'))
        } else if (error.response?.status === 410) {
          setInvitationError(t('inviteAccept.errors.alreadyUsed'))
        } else {
          setInvitationError(t('inviteAccept.errors.loadError'))
        }
      } finally {
        setIsLoadingInvitation(false)
      }
    }

    fetchInvitationDetails()
  }, [token, t])

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: AcceptInvitationFormData) => {
      const response = await api.post(`/api/v1/invitations/${token}/accept`, {
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        pin: data.pin || null,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('inviteAccept.success.title'),
        description: t('inviteAccept.success.description'),
      })
      // Redirect to login with the email pre-filled
      navigate('/login', {
        state: {
          email: invitationDetails?.email,
          message: t('inviteAccept.success.loginMessage'),
        },
      })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || t('inviteAccept.errors.acceptError')
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AcceptInvitationFormData) => {
    acceptInvitationMutation.mutate(data)
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">{t('inviteAccept.loading')}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitationError || !invitationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>{t('inviteAccept.invalidTitle')}</CardTitle>
            <CardDescription>{invitationError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              {t('inviteAccept.goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if invitation is expired
  const isExpired = new Date(invitationDetails.expiresAt) < new Date()

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>{t('inviteAccept.expiredTitle')}</CardTitle>
            <CardDescription>
              {t('inviteAccept.expiredDescription', {
                date: new Date(invitationDetails.expiresAt).toLocaleDateString(t('common.locale'))
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              {t('inviteAccept.goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>{t('inviteAccept.joinTitle')}</CardTitle>
          <CardDescription>
            {t('inviteAccept.invitedTo')} <strong>{invitationDetails.organizationName}</strong>
            {invitationDetails.venueName && (
              <>
                {' '}
                {t('inviteAccept.at')} <strong>{invitationDetails.venueName}</strong>
              </>
            )}{' '}
            {t('inviteAccept.as')} <strong>{invitationDetails.role}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('inviteAccept.emailLabel')}: <strong>{invitationDetails.email}</strong>
              </AlertDescription>
            </Alert>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('inviteAccept.labels.firstName')} *</Label>
                <Input id="firstName" placeholder={t('inviteAccept.placeholders.firstName')} {...register('firstName')} />
                {errors.firstName && <p className="text-sm text-red-600">{errors.firstName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">{t('inviteAccept.labels.lastName')} *</Label>
                <Input id="lastName" placeholder={t('inviteAccept.placeholders.lastName')} {...register('lastName')} />
                {errors.lastName && <p className="text-sm text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('inviteAccept.labels.password')} *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('inviteAccept.placeholders.password')}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('inviteAccept.labels.confirmPassword')} *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('inviteAccept.placeholders.confirmPassword')}
                  className="pr-10"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            {/* PIN Field */}
            <div className="space-y-2">
              <Label htmlFor="pin">{t('inviteAccept.labels.pin')}</Label>
              <Input id="pin" type="text" placeholder={t('inviteAccept.placeholders.pin')} maxLength={4} {...register('pin')} />
              {errors.pin && <p className="text-sm text-red-600">{errors.pin.message}</p>}
              <p className="text-xs text-muted-foreground">{t('inviteAccept.pinHelp')}</p>
            </div>

            <Button type="submit" disabled={!isValid || acceptInvitationMutation.isPending} className="w-full">
              {acceptInvitationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('inviteAccept.creatingAccount')}
                </>
              ) : (
                t('inviteAccept.acceptButton')
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>{t('inviteAccept.termsText')}</p>
            <p className="mt-2">
              {t('inviteAccept.haveAccount')}{' '}
              <button onClick={() => navigate('/login')} className="text-blue-600 hover:text-blue-800 underline">
                {t('inviteAccept.loginHere')}
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
