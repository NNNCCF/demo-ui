<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  FirstAidKit,
  Headset,
  Monitor,
  Place,
  User,
  Promotion,
  Setting,
  Tickets,
  House,
  OfficeBuilding,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import logoImage from '@/image/main-left-top-image.png'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuList = [
  { name: '首页地图', path: '/dashboard', icon: Place },
  { name: '设备列表', path: '/devices', icon: Monitor },
  { name: '报警记录', path: '/alarms', icon: Headset },
  { name: '医护绑定', path: '/caregiver', icon: FirstAidKit },
  { name: '预约订单', path: '/service-orders', icon: Tickets },
  { name: '用户管理', path: '/users', icon: User },
  { name: '动态发布', path: '/news', icon: Promotion },
  { name: '家庭管理', path: '/families', icon: House },
  { name: '机构管理', path: '/organizations', icon: OfficeBuilding },
  { name: '系统管理', path: '/system', icon: Setting },
]

const visibleMenus = computed(() => {
  const role = authStore.userInfo?.role
  const orgType = authStore.userInfo?.orgType
  return menuList.filter((item) => {
    // 机构管理、系统管理：仅 ADMIN 可见
    if (item.path === '/system' && role !== 'ADMIN') return false
    if (item.path === '/organizations' && role !== 'ADMIN') return false
    // 社区账号：隐藏机构管理、系统管理（已由上面处理）
    // 医疗机构账号：额外隐藏医护绑定
    if (item.path === '/caregiver' && orgType === 'MEDICAL_INSTITUTION') return false
    return true
  })
})

function handleSelect(path: string) {
  if (path === route.path) {
    return
  }
  router.push({ path })
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
  background: #2563eb; /* Active blue */
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

:deep(.el-icon) {
  margin-right: 0 !important;
  font-size: 22px;
}
</style>
