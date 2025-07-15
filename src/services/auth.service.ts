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
