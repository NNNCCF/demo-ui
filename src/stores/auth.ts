import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { UserRole } from '@/types'

interface UserInfo {
  userId: number
  role: UserRole
  username?: string
  orgId?: number | null
  orgType?: string | null
  forcePasswordChange?: boolean
}

const TOKEN_KEY = 'health_iot_token'
const USER_KEY = 'health_iot_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(
    localStorage.getItem(USER_KEY) ? JSON.parse(localStorage.getItem(USER_KEY) as string) : null,
  )
  const isAuthenticated = computed(() => Boolean(token.value))

  function setAuth(nextToken: string, nextUserInfo: UserInfo) {
    token.value = nextToken
    userInfo.value = nextUserInfo
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUserInfo))
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  function updateUserInfo(nextUserInfo: UserInfo) {
    userInfo.value = nextUserInfo
    localStorage.setItem(USER_KEY, JSON.stringify(nextUserInfo))
  }

  return {
    token,
    userInfo,
    isAuthenticated,
    setAuth,
    updateUserInfo,
    logout,
  }
})
