<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

function handleLocaleChange(value: string) {
  locale.value = value
  appStore.setLocale(value)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <!-- Breadcrumb or other left content could go here -->
    </div>
    <div class="actions">
      <el-select
        :model-value="locale"
        style="width: 100px"
        @update:model-value="handleLocaleChange"
      >
        <el-option label="中文" value="zh-CN" />
        <el-option label="English" value="en-US" />
      </el-select>
      <div class="user-info">
        <span class="role-badge">{{ authStore.userInfo?.role }}</span>
        <span class="user-name">{{ authStore.userInfo?.userId }}</span>
      </div>
      <el-button type="danger" link @click="handleLogout">{{ t('common.logout') }}</el-button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-left {
  flex: 1;
}

.actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.role-badge {
  background: #eff6ff;
  color: #3b82f6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.user-name {
  color: #334155;
  font-weight: 500;
}
</style>
