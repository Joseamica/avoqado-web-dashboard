import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.MODE === 'production' ? import.meta.env.VITE_API_URL : import.meta.env.VITE_API_DEV_URL,
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
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
