import axios from 'axios'
import { del, get, patch, post, put } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import type {
  Alarm,
  AlarmHandleStatus,
  AlarmLevel,
  AlarmType,
  ClientUser,
  CommunityStat,
  DataHistoryResponse,
  Device,
  DeviceLog,
  DeviceType,
  FeedbackItem,
  HeartRateTrendPoint,
  LoginPayload,
  LoginResult,
  MonthlyDeviceStat,
  NewsPost,
  RegisterPayload,
  ServiceOrder,
  ServiceOrderType,
  UserProfile,
} from '@/types'

export const authApi = {
  login: (payload: LoginPayload) => post<LoginResult>('/login', payload),
  register: (payload: RegisterPayload) => post<UserProfile>('/register', payload),
  captcha: (width = 150, height = 50) =>
    axios.get<{ code: number; msg: string; data: { id: string; url: string } }>(
      `https://v2.xxapi.cn/api/captcha?width=${width}&height=${height}&length=4&type=string`,
    ).then((res) => res.data),
  verifyCaptcha: (id: string, key: string) =>
    axios.get<{ code: number; msg: string; data: string }>(
      `https://v2.xxapi.cn/api/captcha?id=${id}&key=${key}&type=string`,
    ).then((res) => res.data),
}

export const deviceApi = {
  list: () => get<Device[]>('/devices'),
  register: (payload: {
    deviceId: string
    deviceType: DeviceType
    targetId?: number
    address?: string
    homeLocation?: string
    roomNumber?: string
    medicalInstitution?: string
    propertyManagement?: string
    guardianId?: number
    wardIds?: number[]
    latitude?: number
    longitude?: number
    familyId?: number
  }) =>
    post<{ deviceId: string; deviceType: DeviceType; status: string }>('/devices', payload),
  update: (deviceId: string, payload: {
    deviceType: DeviceType
    targetId?: number
    address?: string
    homeLocation?: string
    roomNumber?: string
    medicalInstitution?: string
    propertyManagement?: string
    guardianId?: number
    wardIds?: number[]
    latitude?: number
    longitude?: number
    familyId?: number
  }) => put<void>(`/devices/${deviceId}`, payload),
  delete: (deviceId: string) => del<void>(`/devices/${deviceId}`),
  unbind: (deviceId: string) => post<void>('/devices/unbind', { deviceId }),
  reset: (deviceId: string) => post<void>(`/devices/${deviceId}/reset`),
  disable: (deviceId: string) => post<void>(`/devices/${deviceId}/disable`),
  enable: (deviceId: string) => post<void>(`/devices/${deviceId}/enable`),
  control: (payload: { deviceId: string; commandType: string; payload: Record<string, unknown> }) =>
    post<void>('/devices/control', payload),
  logs: (deviceId: string) => get<DeviceLog[]>(`/devices/${deviceId}/logs`),
}

export const dataApi = {
  history: (params: { deviceId: string; startTime: string; endTime: string }) =>
    get<DataHistoryResponse>('/data/history', { params }),
  clearData: (deviceId: string) => del<void>(`/data/${deviceId}`),
}

export const alarmApi = {
  list: (params: {
    guardianId?: number
    alarmLevel?: AlarmLevel
    handleStatus?: AlarmHandleStatus
    startTime: string
    endTime: string
  }) => get<Alarm[]>('/alarms', { params }),
  handle: (payload: { alarmId: number; handleStatus: AlarmHandleStatus; handlerId: number; handleRemark?: string }) =>
    patch<void>(`/alarms/${payload.alarmId}/handle`, payload),
  handleAll: (handlerId: number) =>
    post<number>('/alarms/handle-all', null, { params: { handlerId } }),
  clearAll: () =>
    del<void>('/alarms'),
  getRules: () =>
    get<Record<AlarmType, {
      id: number
      alarmType: AlarmType
      minValue?: number
      maxValue?: number
      continuousTimes?: number
      offlineMinutes?: number
      alarmLevel: AlarmLevel
    }>>('/alarms/rules'),
  updateRule: (payload: {
    alarmType: AlarmType
    minValue?: number
    maxValue?: number
    continuousTimes?: number
    offlineMinutes?: number
    alarmLevel?: AlarmLevel
  }) => patch<void>('/alarms/rules', payload),
  export: (params: { startTime: string; endTime: string }) =>
    get<Blob>('/alarms/export', { params, responseType: 'blob' }),
}

export const statsApi = {
  monthly: () => get<MonthlyDeviceStat[]>('/stats/monthly'),
  community: () => get<CommunityStat[]>('/stats/community'),
  trend: (deviceId: string, days = 7) => get<HeartRateTrendPoint[]>('/stats/trend', { params: { deviceId, days } }),
}

// Note: /stats/* is accessible to ADMIN and GUARDIAN roles

export const serviceOrderApi = {
  list: (paramsOrTargetId: number | {
    targetId?: number
    status?: string
    orderType?: ServiceOrderType
    startTime?: string
    endTime?: string
  }) => {
    const params = typeof paramsOrTargetId === 'number' ? { targetId: paramsOrTargetId } : paramsOrTargetId
    return get<ServiceOrder[]>('/service-orders', { params })
  },
  create: (payload: { orderType: ServiceOrderType; targetId: number; appointmentTime: string }) =>
    post<ServiceOrder>('/service-orders', payload),
  updateStatus: (id: number, status: string) => patch<void>(`/service-orders/${id}/status`, { status }),
}

export const logApi = {
  operationLogs: (startTime: string, endTime: string) =>
    get<{ operatorId: number; action: string; resource: string; result: string; timestamp: string }[]>(
      '/admin/logs/operation',
      { params: { startTime, endTime } },
    ),
  loginLogs: (startTime: string, endTime: string) =>
    get<{ userId: number; ip: string; location: string; status: string; loginTime: string }[]>(
      '/admin/logs/login',
      { params: { startTime, endTime } },
    ),
  notificationLogs: (startTime: string, endTime: string) =>
    get<{ targetId: number; channel: string; payload: string; sentAt: string; result: string }[]>(
      '/admin/logs/notification',
      { params: { startTime, endTime } },
    ),
}

export const clientUserApi = {
  list: () => get<ClientUser[]>('/client-users'),
  get: (id: number) => get<ClientUser>(`/client-users/${id}`),
  create: (payload: {
    mobile?: string
    name: string
    password?: string
    role: string
    gender?: 'MALE' | 'FEMALE'
    birthday?: string
    height?: number
    weight?: number
    wardRole?: string
    chronicDisease?: string
    remark?: string
  }) => post<{ id: number }>('/client-users', payload),
  update: (id: number, payload: {
    mobile: string
    name: string
    password?: string
    role: string
    gender?: 'MALE' | 'FEMALE'
    birthday?: string
    height?: number
    weight?: number
    wardRole?: string
    chronicDisease?: string
    remark?: string
  }) => put<void>(`/client-users/${id}`, payload),
  delete: (id: number) => del<void>(`/client-users/${id}`),
  bindDevice: (id: number, deviceId: string) => post<void>(`/client-users/${id}/devices`, { deviceId }),
  unbindDevice: (id: number, deviceId: string) => del<void>(`/client-users/${id}/devices/${deviceId}`),
}

export const adminApi = {
  users: () => get<UserProfile[]>('/admin/users'),
  createUser: (payload: {
    userId: number
    username: string
    password: string
    role: 'ADMIN' | 'GUARDIAN'
    region?: string
    phone?: string
    orgId?: number
  }) => post<UserProfile>('/admin/users', payload),
  updateUserStatus: (payload: { userId: number; status: 'ENABLED' | 'DISABLED' }) =>
    patch<void>('/admin/users/status', payload),
  resetPassword: (userId: number, newPassword: string) =>
    patch<void>(`/admin/users/${userId}/reset-password`, { newPassword }),
  commandLogs: (startTime: string, endTime: string) =>
    get<{ id: number; deviceId?: string; commandBody: string; sentAt: string; responseStatus?: string }[]>(
      '/admin/logs/commands',
      { params: { startTime, endTime } },
    ),
  systemConfig: () => get<Record<string, string>>('/admin/system/config'),
  saveSystemConfig: (params: Record<string, string>) => put<void>('/admin/system/config', params),
  systemStatus: () => {
    const authStore = useAuthStore()
    return axios.get<{ code: number; data: any }>('/api/admin/system/status', {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    }).then(r => r.data.data)
  },
}

export const feedbackAdminApi = {
  list: (params?: {
    status?: string
    type?: string
    submitterRole?: string
    keyword?: string
  }) => get<FeedbackItem[]>('/admin/feedbacks', { params }),
  updateStatus: (id: number, status: string) =>
    patch<void>(`/admin/feedbacks/${id}/status`, { status }),
}

export const newsApi = {
  list: () => get<NewsPost[]>('/news'),
  getById: (id: number) => get<NewsPost>(`/news/${id}`),
  create: (payload: {
    title: string
    content: string
    visibility: string
    publisherId: number
    publisherName: string
    publishTime: string
    attachments: string[]
  }) => post<NewsPost>('/news', payload),
  update: (id: number, payload: {
    title: string
    content: string
    visibility: string
    publisherId: number
    publisherName: string
    publishTime: string
    attachments: string[]
  }) => put<NewsPost>(`/news/${id}`, payload),
  delete: (id: number) => del<void>(`/news/${id}`),
}

export const institutionAdminApi = {
  /** 创建机构管理员（小程序端 INSTITUTION 角色） */
  create: (payload: { phone: string; password: string; name: string; orgId: number }) =>
    post<{ id: number; name: string; phone: string; orgId: number }>('/admin/institution-admin/create', payload),
}

export const organizationApi = {
  list: () => get<{ id: number; name: string; type: string; region: string; contactPhone: string; status: string; createdAt: string }[]>('/organizations'),
  create: (payload: { name: string; type?: string; region?: string; contactPhone?: string }) =>
    post<{ id: number }>('/admin/organizations', payload),
  update: (id: number, payload: { name: string; type?: string; region?: string; contactPhone?: string }) =>
    put<void>(`/admin/organizations/${id}`, payload),
  setStatus: (id: number, status: 'ENABLED' | 'DISABLED') =>
    patch<void>(`/admin/organizations/${id}/status`, { status }),
}

export const familyApi = {
  list: () => get<{ id: number; name: string; address: string; orgId: number; caregiverId?: number; createdAt: string; guardians: { id: number; name: string; mobile?: string }[] }[]>('/families'),
  detail: (id: number) => get<{
    id: number; name: string; address: string; orgId: number; createdAt: string;
    guardians: { id: number; name: string; mobile?: string; role?: string }[];
    devices: { deviceId: string; deviceType: string; address?: string; roomNumber?: string; homeLocation?: string; medicalInstitution?: string; propertyManagement?: string; latitude?: number; longitude?: number; status: string; wards?: { memberId: number; name: string }[] }[];
  }>(`/families/${id}/detail`),
  create: (payload: { name: string; address?: string; orgId?: number }) =>
    post<{ id: number }>('/families', payload),
  update: (id: number, payload: { name: string; address?: string }) =>
    put<void>(`/families/${id}`, payload),
  delete: (id: number) => del<void>(`/families/${id}`),
  addGuardian: (familyId: number, clientUserId: number) =>
    post<void>(`/families/${familyId}/guardians`, { clientUserId }),
  removeGuardian: (familyId: number, clientUserId: number) =>
    del<void>(`/families/${familyId}/guardians/${clientUserId}`),
  /** 将护工机构绑定到家庭（设置 family.orgId = caregiver.orgId） */
  bindCaregiver: (familyId: number, caregiverId: number) =>
    post<void>(`/families/${familyId}/bind-caregiver`, { caregiverId }),
}

export const caregiverApi = {
  /** 将护工分配到机构（设置 user.orgId） */
  assignOrg: (userId: number, orgId: number) =>
    patch<void>(`/client-users/${userId}/assign-org`, { orgId }),
}

export const wardApi = {
  list: () => get<{ memberId: number; name: string }[]>('/wards'),
}
