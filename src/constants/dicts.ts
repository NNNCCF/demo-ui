import type {
  AlarmHandleStatus,
  AlarmLevel,
  AlarmType,
  DeviceStatus,
  DeviceType,
  ServiceOrderStatus,
  ServiceOrderType,
  UserRole,
} from '@/types'

export const roleLabelMap: Record<UserRole, string> = {
  ADMIN: 'Admin',
  GUARDIAN: 'Guardian',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  CAREGIVER: 'Caregiver',
  INSTITUTION: 'Institution',
}

export const deviceTypeLabelMap: Record<DeviceType, string> = {
  HEART_RATE: 'Heart rate',
  FALL_DETECTOR: 'Fall detector',
  LOCATOR: 'Locator',
  HEALTH_MONITOR: 'Health monitor',
}

export const deviceStatusLabelMap: Record<DeviceStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  DISABLED: 'Disabled',
}

export const alarmTypeLabelMap: Record<AlarmType, string> = {
  HEART_RATE: 'Heart rate',
  BREATH_RATE: 'Breath rate',
  FALL: 'Fall',
  DEVICE_OFFLINE: 'Device offline',
}

export const alarmLevelLabelMap: Record<AlarmLevel, string> = {
  NORMAL: 'Normal',
  EMERGENCY: 'Emergency',
}

export const alarmStatusLabelMap: Record<AlarmHandleStatus, string> = {
  UNHANDLED: 'Unhandled',
  HANDLED: 'Handled',
  IGNORED: 'Ignored',
}

export const serviceTypeLabelMap: Record<ServiceOrderType, string> = {
  MEDICINE_DELIVERY: 'Medicine delivery',
  HOME_VISIT: 'Home visit',
  PHYSICAL_EXAM: 'Physical exam',
}

export const serviceStatusLabelMap: Record<ServiceOrderStatus, string> = {
  PENDING: 'Pending',
  DISPATCHED: 'Dispatched',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In service',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}
