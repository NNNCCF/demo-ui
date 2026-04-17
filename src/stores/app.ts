import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const requestCount = ref(0)
  const locale = ref(localStorage.getItem('locale') || 'zh-CN')
  const loading = computed(() => requestCount.value > 0)

  function startRequest() {
    requestCount.value += 1
  }

  function endRequest() {
    requestCount.value = Math.max(0, requestCount.value - 1)
  }

  function setLocale(nextLocale: string) {
    locale.value = nextLocale
    localStorage.setItem('locale', nextLocale)
  }

  return {
    loading,
    locale,
    startRequest,
    endRequest,
    setLocale,
  }
})
