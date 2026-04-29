import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

api.interceptors.request.use((config) => {
  const url = config.url || ''
  if (url.startsWith('/qa/')) {
    const qaToken = localStorage.getItem('knowq-qa-token')
    if (qaToken) {
      config.headers.Authorization = `Bearer ${qaToken}`
      return config
    }
  }
  const token = localStorage.getItem('knowq-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      if (url.startsWith('/qa/')) {
        localStorage.removeItem('knowq-qa-token')
        localStorage.removeItem('knowq-qa-user')
      } else {
        localStorage.removeItem('knowq-token')
        localStorage.removeItem('knowq-user')
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
