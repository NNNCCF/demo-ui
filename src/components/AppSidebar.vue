<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Bell,
  ChatDotRound,
  FirstAidKit,
  Monitor,
  Place,
  Promotion,
  Setting,
  Tickets,
  House,
  OfficeBuilding,
  Phone,
  User,
  SwitchButton,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import logoImage from '@/image/main-left-top-image.png'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuList = [
  { name: '首页地图', path: '/dashboard', icon: Place },
  { name: '设备列表', path: '/devices', icon: Monitor },
  { name: '告警记录', path: '/alarms', icon: Bell },
  { name: '医护绑定', path: '/caregiver', icon: FirstAidKit },
  { name: '预约订单', path: '/service-orders', icon: Tickets },
  { name: '用户管理', path: '/users', icon: User },
  { name: '意见反馈', path: '/feedbacks', icon: ChatDotRound },
  { name: '动态发布', path: '/news', icon: Promotion },
  { name: '家庭管理', path: '/families', icon: House },
  { name: '机构管理', path: '/organizations', icon: OfficeBuilding },
  { name: '物业信息', path: '/property-managements', icon: OfficeBuilding },
  { name: '客服电话', path: '/call-records', icon: Phone },
  { name: '医生管理', path: '/doctors', icon: User },
  { name: '角色权限', path: '/role-permissions', icon: Setting },
  { name: '系统管理', path: '/system', icon: Setting },
]

const visibleMenus = computed(() => {
  const role = authStore.userInfo?.role
  const orgType = authStore.userInfo?.orgType

  return menuList.filter((item) => {
    if (item.path === '/system' && role !== 'ADMIN') return false
    if (item.path === '/organizations' && role !== 'ADMIN') return false
    if (item.path === '/feedbacks' && role !== 'ADMIN') return false
    if (item.path === '/property-managements' && role !== 'ADMIN') return false
    if (item.path === '/call-records' && role !== 'ADMIN') return false
    if (item.path === '/role-permissions' && role !== 'ADMIN') return false
    if (item.path === '/doctors' && role !== 'ADMIN') return false
    if (item.path === '/caregiver' && role !== 'ADMIN' && orgType === 'MEDICAL_INSTITUTION') return false
    return true
  })
})

function handleSelect(path: string) {
  if (path === route.path) {
    return
  }
  router.push({ path })
}

function logout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="sidebar-container">
    <div class="brand">
      <img :src="logoImage" class="sidebar-logo" alt="卓凯安伴" />
      <div class="brand-text">卓凯安伴</div>
    </div>

    <el-menu
      :default-active="route.path"
      class="custom-menu"
      @select="handleSelect"
    >
      <el-menu-item v-for="item in visibleMenus" :key="item.path" :index="item.path">
        <el-icon :size="24">
          <component :is="item.icon" />
        </el-icon>
        <span class="menu-label">{{ item.name }}</span>
      </el-menu-item>
    </el-menu>

    <div class="logout-area" @click="logout">
      <el-icon :size="22"><SwitchButton /></el-icon>
      <span class="menu-label">退出登录</span>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  height: 100%;
  background: #0a2463;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30px;
  color: #fff;
}

.sidebar-logo {
  width: 48px;
  height: auto;
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.brand-text {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 1px;
}

.custom-menu {
  border-right: none;
  background: transparent;
  width: 100%;
}

:deep(.el-menu-item) {
  height: auto;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
  padding: 0 !important;
}

:deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

:deep(.el-menu-item.is-active) {
  background: #2563eb;
  color: #fff;
  position: relative;
}

:deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #60a5fa;
}

.menu-label {
  margin-top: 6px;
  font-size: 12px;
}

.logout-area {
  margin-top: auto;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  width: 100%;
  transition: color 0.2s;
}

.logout-area:hover {
  color: #f56c6c;
}

:deep(.el-icon) {
  margin-right: 0 !important;
  font-size: 22px;
}
</style>
