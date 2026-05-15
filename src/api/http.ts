import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { AxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  const appStore = useAppStore()
  appStore.startRequest()
  if (authStore.token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const appStore = useAppStore()
    appStore.endRequest()
    return response
  },
  (error) => {
    const appStore = useAppStore()
    appStore.endRequest()
    const authStore = useAuthStore()
    const status = error?.response?.status
    if (status === 401) {
      authStore.logout()
      ElMessage.error('登录状态已过期，请重新登录')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    if (status === 429) {
      ElMessage.error('请求过于频繁，请稍后再试')
      return Promise.reject(error)
    }
    ElMessage.error(error?.response?.data?.message || error.message || '网络异常')
    return Promise.reject(error)
  },
)

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiResponse<T> | T>(config)
  if (config.responseType === 'blob' || config.responseType === 'arraybuffer') {
    return response.data as T
  }
  const payload = response.data
  if (!payload || typeof payload !== 'object' || !('code' in payload)) {
    return payload as T
  }
  const apiPayload = payload as ApiResponse<T>
  if (apiPayload.code !== 0) {
    ElMessage.error(payload.message || '请求失败')
    throw new Error(payload.message || '请求失败')
  }
  return apiPayload.data
}

export function get<T>(url: string, config?: AxiosRequestConfig) {
  return request<T>({ ...config, method: 'GET', url })
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return request<T>({ ...config, method: 'POST', url, data })
}

export function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return request<T>({ ...config, method: 'PATCH', url, data })
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return request<T>({ ...config, method: 'PUT', url, data })
}

export function del<T>(url: string, config?: AxiosRequestConfig) {
  return request<T>({ ...config, method: 'DELETE', url })
}

export { http }
