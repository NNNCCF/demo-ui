import { del, get, http, patch, post, put } from '@/api/http'
import { saveAs } from 'file-saver'
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
  DeviceProvisioningResult,
  DeviceType,
  Doctor,
  AuthCaptcha,
  FeedbackItem,
  HeartRateTrendPoint,
  LoginPayload,
  LoginResult,
  MonthlyDeviceStat,
  NewsPost,
  RegisterPayload,
  NurseItem,
  PageResult,
  PaymentRecord,
  PropertyManagement,
  CallRecord,
  ServiceOrder,
  ServiceOrderType,
  UserProfile,
} from '@/types'

export const authApi = {
  login: (payload: LoginPayload) => post<LoginResult>('/login', payload),
  register: (payload: RegisterPayload) => post<UserProfile>('/register', payload),
  getCaptcha: (scene: 'LOGIN' | 'REGISTER') =>
    get<AuthCaptcha>('/auth/captcha', { params: { scene } }),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    post<void>('/account/change-password', payload),
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
    post<DeviceProvisioningResult>('/devices', payload),
  rotateCredentials: (deviceId: string) =>
    post<DeviceProvisioningResult>(`/devices/${deviceId}/mqtt-credentials`),
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
  unbind: (deviceId: string) => del<void>(`/devices/${deviceId}/binding`),
  reset: (deviceId: string) => post<void>(`/devices/${deviceId}/reset`),
  disable: (deviceId: string) => patch<void>(`/devices/${deviceId}/status`, { status: 'DISABLED' }),
  enable: (deviceId: string) => patch<void>(`/devices/${deviceId}/status`, { status: 'ENABLED' }),
  control: (payload: { deviceId: string; commandType: string; payload: Record<string, unknown> }) =>
    post<void>(`/devices/${payload.deviceId}/commands`, {
      commandType: payload.commandType,
      payload: payload.payload,
    }),
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
  clearAll: (guardianId?: number) =>
    del<void>('/alarms', guardianId !== undefined ? { params: { guardianId } } : undefined),
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
    http.get<Blob>('/alarms/export', { params, responseType: 'blob' }).then((response) => {
      const disposition = response.headers['content-disposition']
      const match = typeof disposition === 'string' ? disposition.match(/filename="?([^"]+)"?/) : null
      saveAs(response.data, match?.[1] || 'alarms.xlsx')
    }),
}

export const statsApi = {
  monthly: () => get<MonthlyDeviceStat[]>('/stats/monthly'),
  community: () => get<CommunityStat[]>('/stats/community'),
  trend: (deviceId: string, days = 7) => get<HeartRateTrendPoint[]>('/stats/trend', { params: { deviceId, days } }),
}

// Note: /stats/* is accessible to ADMIN and GUARDIAN roles

export const serviceOrderApi = {
  list: (params: { targetId?: number; orgId?: number; status?: string; orderType?: ServiceOrderType; keyword?: string; page?: number; size?: number }) =>
    get<PageResult<ServiceOrder>>('/service-orders', { params }),
  detail: (id: number) => get<ServiceOrder>(`/service-orders/${id}`),
  create: (payload: {
    orderType: ServiceOrderType
    targetId: number
    appointmentTime: string
    status?: string
    orgId?: number
    familyId?: number
    memberId?: number
    guardianId?: number
    createdById?: number
    nurseId?: number
    nurseName?: string
    nursePhone?: string
    displayType?: string
    contactName?: string
    contactPhone?: string
    serviceAddress?: string
    medicineList?: string
    requirement?: string
    acceptTime?: string
    dispatchedBy?: string
    visitTime?: string
    payAmount?: string
    payStatus?: string
    visitRemark?: string
  }) => post<ServiceOrder>('/service-orders', payload),
  update: (id: number, payload: {
    orderType: ServiceOrderType
    targetId: number
    appointmentTime: string
    status?: string
    orgId?: number
    familyId?: number
    memberId?: number
    guardianId?: number
    createdById?: number
    nurseId?: number
    nurseName?: string
    nursePhone?: string
    displayType?: string
    contactName?: string
    contactPhone?: string
    serviceAddress?: string
    medicineList?: string
    requirement?: string
    acceptTime?: string
    dispatchedBy?: string
    visitTime?: string
    payAmount?: string
    payStatus?: string
    visitRemark?: string
  }) => put<ServiceOrder>(`/service-orders/${id}`, payload),
  delete: (id: number) => del<void>(`/service-orders/${id}`),
  updateStatus: (id: number, status: string) => patch<void>(`/service-orders/${id}/status`, { status }),
  dispatch: (id: number, nurseId: number, nurseName: string) =>
    patch<void>(`/service-orders/${id}/dispatch`, { nurseId, nurseName }),
  listNurses: (orgId?: number | null) =>
    get<NurseItem[]>('/service-orders/nurses', { params: orgId ? { orgId } : {} }),
}

export const paymentApi = {
  create: (payload: { orderId: number; amount: string; channel: 'MOCK' }) =>
    post<PaymentRecord>('/payments/create', payload),
  detail: (id: number) => get<PaymentRecord>(`/payments/${id}`),
  mockCallback: (id: number, payload: { status: 'PAID' | 'FAILED'; tradeNo?: string }) =>
    post<PaymentRecord>(`/payments/${id}/mock-callback`, payload),
}

export const logApi = {
  operationLogs: (startTime: string, endTime: string) =>
    get<{ operatorId: number; action: string; resource: string; result: string; timestamp: string }[]>(
      '/admin/logs/operations',
      { params: { startTime, endTime } },
    ),
  loginLogs: (startTime: string, endTime: string) =>
    get<{ userId: number; ip: string; location: string; status: string; loginTime: string }[]>(
      '/admin/logs/logins',
      { params: { startTime, endTime } },
    ),
  notificationLogs: (startTime: string, endTime: string) =>
    get<{ targetId: number; channel: string; payload: string; sentAt: string; result: string }[]>(
      '/admin/logs/notifications',
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
    username: string
    password: string
    role: 'ADMIN' | 'GUARDIAN'
    region?: string
    phone?: string
    orgId?: number
  }) => post<UserProfile>('/admin/users', payload),
  updateUserStatus: (payload: { userId: number; status: 'ENABLED' | 'DISABLED' }) =>
    patch<void>(`/admin/users/${payload.userId}/status`, { status: payload.status }),
  resetPassword: (userId: number, newPassword: string) =>
    patch<void>(`/admin/users/${userId}/reset-password`, { newPassword }),
  commandLogs: (startTime: string, endTime: string) =>
    get<{ id: number; deviceId?: string; commandBody: string; sentAt: string; responseStatus?: string }[]>(
      '/admin/logs/commands',
      { params: { startTime, endTime } },
    ),
  systemConfig: () => get<Record<string, string>>('/admin/system/config'),
  saveSystemConfig: (params: Record<string, string>) => put<void>('/admin/system/config', params),
  systemStatus: () => get<any>('/admin/system/status'),
}

export const feedbackAdminApi = {
  list: (params?: {
    status?: string
    type?: string
    submitterRole?: string
    keyword?: string
  }) => get<FeedbackItem[]>('/admin/feedbacks', { params }),
  detail: (id: number) => get<FeedbackItem>(`/admin/feedbacks/${id}`),
  create: (payload: {
    submitterId?: number
    submitterRole?: string
    type: string
    content: string
    status?: string
  }) => post<FeedbackItem>('/admin/feedbacks', payload),
  update: (id: number, payload: {
    submitterId?: number
    submitterRole?: string
    type: string
    content: string
    status?: string
  }) => put<FeedbackItem>(`/admin/feedbacks/${id}`, payload),
  delete: (id: number) => del<void>(`/admin/feedbacks/${id}`),
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

export const propertyManagementApi = {
  list: (params?: { keyword?: string }) =>
    get<PropertyManagement[]>('/admin/property-managements', { params }),
  create: (payload: Omit<PropertyManagement, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<PropertyManagement>('/admin/property-managements', payload),
  update: (id: number, payload: Omit<PropertyManagement, 'id' | 'createdAt' | 'updatedAt'>) =>
    put<PropertyManagement>(`/admin/property-managements/${id}`, payload),
  delete: (id: number) => del<void>(`/admin/property-managements/${id}`),
}

export const callRecordApi = {
  list: (params?: { keyword?: string }) =>
    get<CallRecord[]>('/admin/call-records', { params }),
  create: (payload: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<CallRecord>('/admin/call-records', payload),
  update: (id: number, payload: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>) =>
    put<CallRecord>(`/admin/call-records/${id}`, payload),
  delete: (id: number) => del<void>(`/admin/call-records/${id}`),
}

export const doctorApi = {
  list: (orgId?: number) =>
    get<Doctor[]>('/doctors', orgId !== undefined ? { params: { orgId } } : undefined),
  get: (id: number) => get<Doctor>(`/doctors/${id}`),
  create: (payload: { mobile: string; name: string; password: string; introduction?: string; title?: string; orgId: number }) =>
    post<Doctor>('/doctors', payload),
  update: (id: number, payload: { mobile: string; name: string; introduction?: string; title?: string; orgId: number }) =>
    put<Doctor>(`/doctors/${id}`, payload),
  delete: (id: number) => del<void>(`/doctors/${id}`),
}

export const rolePermissionApi = {
  get: () => get<Record<UserProfile['role'], string[]>>('/admin/role-permissions'),
  update: (role: string, routes: string[]) =>
    patch<Record<string, string[]>>(`/admin/role-permissions/${role}`, { routes }),
}
