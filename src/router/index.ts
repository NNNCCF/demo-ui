import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/views/ChangePasswordView.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: '/dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/devices',
          name: 'devices',
          component: () => import('@/views/DeviceView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/devices/:id',
          name: 'device-detail',
          component: () => import('@/views/DeviceDetailView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/alarms',
          name: 'alarms',
          component: () => import('@/views/AlarmView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/caregiver',
          name: 'caregiver',
          component: () => import('@/views/CaregiverView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/service-orders',
          name: 'service-orders',
          component: () => import('@/views/ServiceOrderView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/news',
          name: 'news',
          component: () => import('@/views/NewsView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/feedbacks',
          name: 'feedbacks',
          component: () => import('@/views/FeedbackView.vue'),
          meta: { roles: ['ADMIN'] as UserRole[] },
        },
        {
          path: '/users',
          name: 'users',
          component: () => import('@/views/ClientUserView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/organizations',
          name: 'organizations',
          component: () => import('@/views/OrganizationView.vue'),
          meta: { roles: ['ADMIN'] as UserRole[] },
        },
        {
          path: '/families',
          name: 'families',
          component: () => import('@/views/FamilyView.vue'),
          meta: { roles: ['ADMIN', 'GUARDIAN'] as UserRole[] },
        },
        {
          path: '/system',
          name: 'system',
          component: () => import('@/views/SystemView.vue'),
          meta: { roles: ['ADMIN'] as UserRole[] },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  if (to.meta.public) {
    if (authStore.isAuthenticated) {
      if (authStore.userInfo?.forcePasswordChange) {
        next('/change-password')
        return
      }
      if (to.path === '/login') {
        next('/dashboard')
        return
      }
    }
    next()
    return
  }
  if (!authStore.isAuthenticated) {
    next('/login')
    return
  }
  if (authStore.userInfo?.forcePasswordChange && to.path !== '/change-password') {
    next('/change-password')
    return
  }
  if (!authStore.userInfo?.forcePasswordChange && to.path === '/change-password') {
    next('/dashboard')
    return
  }
  const routeRoles = (to.meta.roles as UserRole[] | undefined) || []
  if (routeRoles.length && authStore.userInfo && !routeRoles.includes(authStore.userInfo.role)) {
    next('/dashboard')
    return
  }
  next()
})

export default router
