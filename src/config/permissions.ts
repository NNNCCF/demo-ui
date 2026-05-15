import type { UserRole } from '@/types'

export interface MenuItem {
  name: string
  labelKey: string
  path: string
  roles: UserRole[]
}

export const menus: MenuItem[] = [
  { name: 'dashboard', labelKey: 'common.dashboard', path: '/dashboard', roles: ['ADMIN', 'GUARDIAN'] },
  { name: 'device', labelKey: 'common.device', path: '/devices', roles: ['ADMIN', 'GUARDIAN'] },
  { name: 'alarm', labelKey: 'common.alarm', path: '/alarms', roles: ['ADMIN', 'GUARDIAN'] },
  { name: 'service', labelKey: 'common.service', path: '/service-orders', roles: ['ADMIN', 'GUARDIAN'] },
  { name: 'property-management', labelKey: 'property.management', path: '/property-managements', roles: ['ADMIN'] },
  { name: 'call-record', labelKey: 'call.record', path: '/call-records', roles: ['ADMIN'] },
  { name: 'role-permission', labelKey: 'role.permission', path: '/role-permissions', roles: ['ADMIN'] },
  { name: 'system', labelKey: 'common.system', path: '/system', roles: ['ADMIN'] },
]
