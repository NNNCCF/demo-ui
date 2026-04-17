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
  ADMIN: '超级管理员',
  GUARDIAN: '普通操作员',
}

export const deviceTypeLabelMap: Record<DeviceType, string> = {
  HEART_RATE: '心率仪',
  FALL_DETECTOR: '跌倒检测器',
  LOCATOR: '定位器',
  HEALTH_MONITOR: '健康监测仪',
}

export const deviceStatusLabelMap: Record<DeviceStatus, string> = {
  ONLINE: '在线',
  OFFLINE: '离线',
  DISABLED: '禁用',
}

export const alarmTypeLabelMap: Record<AlarmType, string> = {
  HEART_RATE: '心率异常',
  BREATH_RATE: '呼吸率异常',
  FALL: '跌倒',
  DEVICE_OFFLINE: '设备离线',
}

export const alarmLevelLabelMap: Record<AlarmLevel, string> = {
  NORMAL: '一般',
  EMERGENCY: '紧急',
}

export const alarmStatusLabelMap: Record<AlarmHandleStatus, string> = {
  UNHANDLED: '未处理',
  HANDLED: '已处理',
  IGNORED: '已忽略',
}

export const serviceTypeLabelMap: Record<ServiceOrderType, string> = {
  MEDICINE_DELIVERY: '送药',
  HOME_VISIT: '家访',
  PHYSICAL_EXAM: '体检',
}

export const serviceStatusLabelMap: Record<ServiceOrderStatus, string> = {
  PENDING: '待处理',
  ACCEPTED: '已派单',
  COMPLETED: '已完成',
  CANCELED: '已取消',
}
