import api from '@/api'
import { StaffRole } from '@/types'

export interface LoginDto {
  email: string
  password: string
  venueId?: string
  rememberMe?: boolean
}

export interface AuthResponse {
  message: string
  staff: {
    id: string
    email: string
    firstName: string
    lastName: string
    emailVerified: boolean
    photoUrl: string | null
    venues: {
      role: StaffRole
      venue: {
        id: string
        name: string
        slug: string
        logo: string | null
      }
    }[]
  }
}

export interface AuthStatusResponse {
  authenticated: boolean
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    isVerified: boolean
    photoUrl: string | null
    venues: {
      id: string
      name: string
      slug: string
      logo: string | null
      role: StaffRole
      isOnboardingDemo?: boolean
      features?: {
        active: boolean
        feature: {
          code: string
          name: string
        }
      }[]
    }[]
  } | null
}

export const login = async (credentials: { email: string; password: string; venueId?: string }) => {
  const response = await api.post('/api/v1/dashboard/auth/login', credentials)
  return response.data
}

export const logout = async () => {
  const response = await api.post('/api/v1/dashboard/auth/logout')
  return response.data
}

export const getAuthStatus = async () => {
  const response = await api.get('/api/v1/dashboard/auth/status')
  return response.data
}

export const switchVenue = async (newVenueId: string) => {
  const response = await api.post('/api/v1/dashboard/auth/switch-venue', { venueId: newVenueId })
  return response.data
}

// Google OAuth functions
export const getGoogleAuthUrl = async (): Promise<{ authUrl: string }> => {
  const response = await api.get('/api/v1/dashboard/auth/google/url')
  return response.data
}

export const googleOAuthCallback = async (code: string): Promise<AuthResponse> => {
  const response = await api.post('/api/v1/dashboard/auth/google/callback', { code })
  return response.data
}

export const checkGoogleInvitation = async (
  email: string,
): Promise<{
  hasInvitation: boolean
  venue?: {
    id: string
    name: string
    slug: string
  }
  role?: StaffRole
}> => {
  const response = await api.get(`/api/v1/dashboard/auth/google/check-invitation?email=${encodeURIComponent(email)}`)
  return response.data
}

// Google One Tap login
export const googleOneTapLogin = async (credential: string): Promise<AuthResponse> => {
  const response = await api.post('/api/v1/dashboard/auth/google/one-tap', { credential })
  return response.data
}

// Signup
export interface SignupDto {
  email: string
  password: string
  firstName: string
  lastName: string
  organizationName: string
}

export interface SignupResponse {
  success: boolean
  message: string
  staff: {
    id: string
    email: string
    firstName: string
    lastName: string
    organizationId: string
    photoUrl?: string | null
  }
  organization: {
    id: string
    name: string
  }
}

export const signup = async (data: SignupDto): Promise<SignupResponse> => {
  const response = await api.post('/api/v1/onboarding/signup', data)
  return response.data
}

// Password Reset
export interface RequestPasswordResetDto {
  email: string
}

export interface RequestPasswordResetResponse {
  success: boolean
  message: string
}

export interface ValidateResetTokenResponse {
  success: boolean
  valid: boolean
  email?: string
}

export interface ResetPasswordDto {
  token: string
  newPassword: string
}

export interface ResetPasswordResponse {
  success: boolean
  message: string
}

export const requestPasswordReset = async (email: string): Promise<RequestPasswordResetResponse> => {
  const response = await api.post('/api/v1/dashboard/auth/request-reset', { email })
  return response.data
}

export const validateResetToken = async (token: string): Promise<ValidateResetTokenResponse> => {
  const response = await api.get(`/api/v1/dashboard/auth/validate-reset-token/${token}`)
  return response.data
}

export const resetPassword = async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
  const response = await api.post('/api/v1/dashboard/auth/reset-password', { token, newPassword })
  return response.data
}

// Email Verification
export interface VerifyEmailDto {
  email: string
  verificationCode: string
}

export interface VerifyEmailResponse {
  emailVerified: boolean
  accessToken: string
  refreshToken: string
}

export const verifyEmail = async (data: VerifyEmailDto): Promise<VerifyEmailResponse> => {
  const response = await api.post('/api/v1/onboarding/verify-email', data)
  return response.data
}

// Service object for convenience
export const authService = {
  login,
  logout,
  getAuthStatus,
  switchVenue,
  getGoogleAuthUrl,
  googleOAuthCallback,
  checkGoogleInvitation,
  googleOneTapLogin,
  signup,
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  verifyEmail,
}
