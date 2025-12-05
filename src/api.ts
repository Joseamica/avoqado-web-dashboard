import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // baseURL: 'https://api.avoqado.io',
  withCredentials: true,
  //   headers: {
  //   'X-Client-Type': 'web'
  // }
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      // Don't redirect if already on login page or auth callback
      const currentPath = window.location.pathname
      if (!currentPath.includes('/login') && !currentPath.includes('/auth/google/callback')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
