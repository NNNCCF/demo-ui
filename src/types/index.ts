export type UserRole = 'ADMIN' | 'GUARDIAN'

export type DeviceType = 'HEART_RATE' | 'FALL_DETECTOR' | 'LOCATOR' | 'HEALTH_MONITOR'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DISABLED'

export type AlarmLevel = 'NORMAL' | 'EMERGENCY'
export type AlarmHandleStatus = 'UNHANDLED' | 'HANDLED' | 'IGNORED'
export type AlarmType = 'HEART_RATE' | 'BREATH_RATE' | 'FALL' | 'DEVICE_OFFLINE'

export type ServiceOrderType = 'MEDICINE_DELIVERY' | 'HOME_VISIT' | 'PHYSICAL_EXAM'
export type ServiceOrderStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELED'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface LoginPayload {
  username: string
  role: UserRole
  password: string
}

export interface LoginResult {
  userId: number
  username: string
  role: UserRole
  orgId?: number
  orgType?: string
  token: string
  expireSeconds: number
}

export interface RegisterPayload {
  username: string
  password: string
  role: UserRole
  region?: string
  phone?: string
}

export interface UserProfile {
  userId: number
  username: string
  role: UserRole
  region?: string
  phone?: string
  status: 'ENABLED' | 'DISABLED'
}

export interface Device {
  deviceId: string
  deviceType: DeviceType
  targetId: number | null
  status: DeviceStatus
  createdAt: string
  lastOnlineAt?: string
  lastOfflineAt?: string
  
  // Extended fields for UI
  address?: string
  roomNumber?: string
  homeLocation?: string
  bindTime?: string
  targetName?: string
  guardian?: {
    id: number
    name: string
    mobile?: string
  }
  wards?: {
    memberId: number
    name: string
  }[]
  medicalInstitution?: string
  propertyManagement?: string
  latitude?: number
  longitude?: number
  isFall?: boolean
  familyId?: number
}

export interface DeviceLog {
  id: number
  deviceId: string
  logType: string
  content: string
  occurredAt: string
}

export interface DataHistoryResponse {
  dataList: Record<string, unknown>[]
  total: number
  avgSampleIntervalSeconds: number
}

export interface Alarm {
  id: number
  targetId: number
  deviceId: string
  alarmType: AlarmType
  alarmLevel: AlarmLevel
  alarmTime: string
  handleStatus: AlarmHandleStatus
  handlerId?: number
  handleTime?: string
  handleRemark?: string
}

export interface MonthlyDeviceStat {
  month: string       // "2024-01"
  activeCount: number
  alarmCount: number
}

export interface CommunityStat {
  communityId: number
  communityName: string
  deviceCount: number
  alarmCount: number
}

export interface HeartRateTrendPoint {
  time: string        // ISO datetime string
  avgRate: number
  maxRate: number
  minRate: number
}

export interface ServiceOrder {
  id: number
  orderType: ServiceOrderType
  targetId: number
  appointmentTime: string
  status: ServiceOrderStatus
  remark?: string
  // 小程序预约扩展字段
  displayType?: string
  familyId?: number
  memberId?: number
  guardianId?: number
  nurseId?: number
  nurseName?: string
  requirement?: string
  dispatchedBy?: string
  visitTime?: string
  visitRemark?: string
  payAmount?: string
  payStatus?: string
  createdAt?: string
}

export type ClientUserRole = 'GUARDIAN' | 'WARD' | 'CAREGIVER' | 'INSTITUTION'
export type Gender = 'MALE' | 'FEMALE'

export interface NewsPost {
  id: number
  title: string
  content: string
  visibility: string
  publisherId: number
  publisherName: string
  publishTime: string
  attachments: string
  createdAt: string
}

export interface ClientUser {
  id: number
  mobile: string
  name: string
  role: ClientUserRole
  sourceType?: 'CLIENT_USER' | 'WARD'
  password?: string
  createdAt?: string
  updatedAt?: string
  orgId?: number
  devices: Pick<Device, 'deviceId'>[]
  gender?: Gender
  birthday?: string
  height?: number
  weight?: number
  wardRole?: string
  chronicDisease?: string
  remark?: string
}

export interface FeedbackItem {
  id: number
  submitterId?: number
  submitterRole?: string
  submitterName?: string
  type: string
  content: string
  status: string
  createdAt: string
}
