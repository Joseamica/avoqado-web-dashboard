import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.MODE === 'production' ? import.meta.env.VITE_API_URL : import.meta.env.VITE_API_DEV_URL,
  // baseURL: 'https://api.avoqado.io',
  withCredentials: true,
})

export default api
