import api from '@/api';
import { StaffRole } from '@/types';

export interface LoginDto {
  email: string;
  password: string;
  venueId?: string;
}

export interface AuthResponse {
  message: string;
  staff: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    photoUrl: string | null;
    venues: {
      role: StaffRole;
      venue: {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
      };
    }[];
  };
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    isVerified: boolean;
    photoUrl: string | null;
    venues: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
      role: StaffRole;
      isDemo?: boolean;
      features?: {
        active: boolean;
        feature: {
          code: string;
          name: string;
        };
      }[];
    }[];
  } | null;
}

export const login = async (credentials: { 
  email: string
  password: string 
  venueId?: string 
}) => {
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

export const checkGoogleInvitation = async (email: string): Promise<{
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
