export type UserRole = 'ADMIN' | 'GUARDIAN' | 'DOCTOR' | 'NURSE' | 'CAREGIVER' | 'INSTITUTION'

export type DeviceType = 'HEART_RATE' | 'FALL_DETECTOR' | 'LOCATOR' | 'HEALTH_MONITOR'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'DISABLED'

export type AlarmLevel = 'NORMAL' | 'EMERGENCY'
export type AlarmHandleStatus = 'UNHANDLED' | 'HANDLED' | 'IGNORED'
export type AlarmType = 'HEART_RATE' | 'BREATH_RATE' | 'FALL' | 'DEVICE_OFFLINE'

export type ServiceOrderType = 'MEDICINE_DELIVERY' | 'HOME_VISIT' | 'PHYSICAL_EXAM'
export type ServiceOrderStatus = 'PENDING' | 'DISPATCHED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface LoginPayload {
  username: string
  password: string
  captchaToken: string
  captchaCode: string
}

export interface LoginResult {
  userId: number
  username: string
  role: UserRole
  orgId?: number
  orgType?: string
  token: string
  expireSeconds: number
  forcePasswordChange: boolean
}

export interface RegisterPayload {
  username: string
  password: string
  region?: string
  phone?: string
  captchaToken: string
  captchaCode: string
}

export interface Doctor {
  id: number
  mobile: string
  name: string
  introduction?: string
  title?: string
  orgId: number
  createdAt?: string
}

export interface AuthCaptcha {
  captchaToken: string
  imageUrl: string
  expireSeconds: number
  cooldownSeconds: number
}

export interface UserProfile {
  userId: number
  username: string
  role: UserRole
  region?: string
  phone?: string
  status: 'ENABLED' | 'DISABLED'
  orgId?: number
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

export interface DeviceProvisioningResult {
  deviceId: string
  deviceType: DeviceType
  status: DeviceStatus
  mqttUsername: string
  mqttPassword: string
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
  currentValue?: string
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
  orgId?: number
  nurseId?: number
  nurseName?: string
  nursePhone?: string
  requirement?: string
  dispatchedBy?: string
  visitTime?: string
  visitRemark?: string
  payAmount?: string
  payStatus?: string
  createdAt?: string
  updatedAt?: string
  // 结构化订单字段
  contactName?: string
  contactPhone?: string
  serviceAddress?: string
  medicineList?: string
  acceptTime?: string
  deleted?: boolean
  deletedAt?: string
  deletedBy?: number
}

export interface NurseItem {
  id: number
  name: string
  phone: string
}

export type ClientUserRole = 'GUARDIAN' | 'WARD' | 'CAREGIVER' | 'INSTITUTION'
export type Gender = 'MALE' | 'FEMALE'

export interface NewsPost {
  id: number
  title: string
  content: string
  visibility: string
  category?: string
  targetScope?: string
  targetFamilyId?: number
  targetFamilyName?: string
  publisherId: number
  publisherName: string
  publishTime: string
  attachments: string
  createdAt: string
  updatedAt?: string
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
  updatedAt?: string
}

export interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export interface PaymentRecord {
  id: number
  orderId: number
  amount: number
  channel: 'MOCK'
  status: 'UNPAID' | 'PAID' | 'FAILED' | 'CANCELED'
  tradeNo?: string
  createdAt?: string
  updatedAt?: string
  paidAt?: string
}

export interface PropertyManagement {
  id: number
  name: string
  contactName?: string
  contactPhone?: string
  serviceArea?: string
  address?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface CallRecord {
  id: number
  callerName: string
  phone: string
  content?: string
  handlerName?: string
  durationSeconds?: number
  createdAt?: string
  updatedAt?: string
}
