<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { alarmApi, deviceApi, serviceOrderApi } from '@/api/modules'
import { alarmLevelLabelMap, alarmStatusLabelMap, alarmTypeLabelMap } from '@/constants/dicts'
import { useAuthStore } from '@/stores/auth'
import healthHomeIcon from '@/image/health-home.png'
import warnHomeIcon from '@/image/warn-home.png'
import offlineHomeIcon from '@/image/offline-home.png'

import type { Alarm, Device } from '@/types'

const mapRef = ref<HTMLElement>()
const authStore = useAuthStore()
const amapKey = import.meta.env.VITE_AMAP_KEY as string | undefined
const amapSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined
let amapPromise: Promise<void> | null = null
let mapInstance: any = null
let mapMarkers: any[] = []
const mapError = ref('')

const summary = ref({
  totalDevices: 0,
  onlineDevices: 0,
  offlineDevices: 0,
  todayEmergencies: 0,
  todayNormals: 0,
  pendingOrders: 0,
  completedOrders: 0,
  monitoringCount: 0,
  alarmFall: 0,
  alarmHeartRate: 0,
  alarmBreathRate: 0,
  alarmDeviceOffline: 0,
  alarmUnhandled: 0,
})

const pointDialogVisible = ref(false)
const currentPointDetail = ref<Record<string, string>>({})
const deviceList = ref<Device[]>([])
interface MapPoint {
  type: string
  name: string
  icon: string
  status: string
  position: [number, number]
  detail: Record<string, string>
}

interface DashboardAlarmItem extends Alarm {
  targetName: string
  address: string
  typeLabel: string
  levelLabel: string
  statusLabel: string
}

const mapPoints = ref<MapPoint[]>([])
const alarmQueue = ref<DashboardAlarmItem[]>([])
const activeAlarm = ref<DashboardAlarmItem | null>(null)
const selectedAlarmResult = ref<'' | 'HANDLED' | 'IGNORED'>('')
const isSubmittingAlarm = ref(false)
const seenAlarmIds = ref<number[]>([])
const DASHBOARD_POLL_INTERVAL_MS = 1000
let devicePolling = false
let alarmPolling = false
let pollTimer: ReturnType<typeof setInterval> | null = null

function isDeviceFalling(device: Device) {
  const value = device.isFall as unknown
  if (typeof value === 'boolean') {
    //console.log('isFall boolean:', value)
    return value
  }
  if (typeof value === 'number') {
    //console.log('isFall number:', value)
    return value === 1
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
    //console.log('isFall string:', normalized)
  }
  return false
}

function resolveDeviceIcon(device: Device) {
  if (isDeviceFalling(device)) {
    return warnHomeIcon
  }
  if (device.status === 'ONLINE') {
    return healthHomeIcon
  }
  if (device.status === 'OFFLINE') {
    return offlineHomeIcon
  }
  return warnHomeIcon
}

function buildMarkerContent(icon: string, isAbnormal = false) {
  return `<div class="device-marker">
    ${isAbnormal ? '<div class="pulse-ring"></div>' : ''}
    <img src="${icon}" class="marker-icon" />
  </div>`
}

function openPoint(point: MapPoint) {
  currentPointDetail.value = point.detail
  pointDialogVisible.value = true
}

function applyDeviceSummary(devices: Awaited<ReturnType<typeof deviceApi.list>>) {
  deviceList.value = devices
  summary.value.totalDevices = devices.length
  summary.value.onlineDevices = devices.filter((d) => d.status === 'ONLINE').length
  summary.value.offlineDevices = devices.filter((d) => d.status !== 'ONLINE').length
  summary.value.monitoringCount = devices.filter((d) => d.targetId).length
  mapPoints.value = devices.map((device) => ({
    type: '设备',
    name: device.deviceId,
    icon: resolveDeviceIcon(device),
    status: device.status,
    position: (device.longitude != null && device.latitude != null) ? [device.longitude, device.latitude] as [number, number] : buildPosition(device.deviceId),
    detail: {
      设备号: device.deviceId,
      类型: device.deviceType,
      状态: device.status,
      被监护人: device.targetName || (device.targetId ? String(device.targetId) : '-'),
      位置: (device.longitude != null && device.latitude != null) ? `${device.longitude}, ${device.latitude}` : buildPosition(device.deviceId).join(', '),
      地址: device.address || '-',
      跌倒状态: isDeviceFalling(device) ? '跌倒' : '正常',
    },
  }))
}

function updateAlarmSummary(alarms: Alarm[]) {
  summary.value.todayEmergencies = alarms.filter((a) => a.alarmLevel === 'EMERGENCY').length
  summary.value.todayNormals = alarms.filter((a) => a.alarmLevel === 'NORMAL').length
  summary.value.alarmFall = alarms.filter((a) => a.alarmType === 'FALL').length
  summary.value.alarmHeartRate = alarms.filter((a) => a.alarmType === 'HEART_RATE').length
  summary.value.alarmBreathRate = alarms.filter((a) => a.alarmType === 'BREATH_RATE').length
  summary.value.alarmDeviceOffline = alarms.filter((a) => a.alarmType === 'DEVICE_OFFLINE').length
  summary.value.alarmUnhandled = alarms.filter((a) => a.handleStatus === 'UNHANDLED').length
}

function buildAlarmQuery(days = 1) {
  const userId = authStore.userInfo?.userId
  const role = authStore.userInfo?.role

  return {
    guardianId: role === 'ADMIN' ? undefined : userId,
    startTime: dayjs().subtract(days, 'day').toISOString(),
    endTime: dayjs().toISOString(),
  }
}

async function fetchDashboardAlarms(days = 1) {
  return alarmApi.list(buildAlarmQuery(days)).catch(() => [])
}

function normalizeDashboardAlarm(alarm: Alarm, devices: Device[]): DashboardAlarmItem {
  const device = devices.find((item) => item.deviceId === alarm.deviceId)
  return {
    ...alarm,
    targetName: device?.targetName || (alarm.targetId ? `监护对象 ${alarm.targetId}` : '未绑定监护对象'),
    address: device?.address || device?.homeLocation || '未配置家庭地址',
    typeLabel: alarmTypeLabelMap[alarm.alarmType] || alarm.alarmType,
    levelLabel: alarmLevelLabelMap[alarm.alarmLevel] || alarm.alarmLevel,
    statusLabel: alarmStatusLabelMap[alarm.handleStatus] || alarm.handleStatus,
  }
}

function sortDashboardAlarms(items: DashboardAlarmItem[]) {
  return [...items].sort((left, right) => dayjs(left.alarmTime).valueOf() - dayjs(right.alarmTime).valueOf())
}

function openNextDashboardAlarm() {
  activeAlarm.value = alarmQueue.value.shift() || null
  selectedAlarmResult.value = ''
}

function enqueueDashboardAlarms(items: DashboardAlarmItem[]) {
  const unseenItems = items.filter((item) => !seenAlarmIds.value.includes(item.id))
  if (!unseenItems.length) {
    return
  }

  alarmQueue.value = sortDashboardAlarms([...alarmQueue.value, ...unseenItems])
  seenAlarmIds.value = [...new Set([...seenAlarmIds.value, ...unseenItems.map((item) => item.id)])]

  if (!activeAlarm.value) {
    openNextDashboardAlarm()
  }
}

async function loadSummary() {
  const [devices, recentAlarms, historicalAlarms, orders] = await Promise.all([
    deviceApi.list(),
    fetchDashboardAlarms(1),
    fetchDashboardAlarms(365),
    serviceOrderApi.list({ targetId: authStore.userInfo?.userId ?? undefined }).catch(() => []),
  ])

  applyDeviceSummary(devices)
  updateAlarmSummary(recentAlarms)
  summary.value.pendingOrders = orders.filter((order) => order.status === 'PENDING').length
  summary.value.completedOrders = orders.filter((order) => order.status === 'COMPLETED').length

  enqueueDashboardAlarms(
    sortDashboardAlarms(
      historicalAlarms
        .filter((item) => item.handleStatus === 'UNHANDLED')
        .map((item) => normalizeDashboardAlarm(item, devices)),
    ),
  )
}

async function refreshAlarmSummarySilently() {
  if (alarmPolling) {
    return
  }
  alarmPolling = true
  try {
    const alarms = await fetchDashboardAlarms(1)
    updateAlarmSummary(alarms)

    enqueueDashboardAlarms(
      sortDashboardAlarms(
        alarms
          .filter((item) => item.handleStatus === 'UNHANDLED')
          .map((item) => normalizeDashboardAlarm(item, deviceList.value)),
      ),
    )
  } finally {
    alarmPolling = false
  }
}

async function refreshDeviceSummarySilently() {
  if (devicePolling) {
    return
  }
  devicePolling = true
  try {
    const devices = await deviceApi.list()
    applyDeviceSummary(devices)
  } finally {
    devicePolling = false
  }
}

async function submitDashboardAlarm() {
  if (!activeAlarm.value || !selectedAlarmResult.value || isSubmittingAlarm.value) {
    return
  }

  const currentAlarm = activeAlarm.value
  isSubmittingAlarm.value = true

  try {
    await alarmApi.handle({
      alarmId: currentAlarm.id,
      handleStatus: selectedAlarmResult.value,
      handlerId: authStore.userInfo?.userId ?? 0,
      handleRemark: selectedAlarmResult.value === 'HANDLED' ? '首页地图弹窗已处理' : '首页地图弹窗已忽略',
    })
    ElMessage.success(selectedAlarmResult.value === 'HANDLED' ? '报警已标记为已处理' : '报警已标记为已忽略')
    activeAlarm.value = null
    selectedAlarmResult.value = ''
    await refreshAlarmSummarySilently()
    openNextDashboardAlarm()
  } catch {
    ElMessage.error('报警处理失败，请重试')
  } finally {
    isSubmittingAlarm.value = false
  }
}

const alarmTotal = computed(() => summary.value.todayEmergencies + summary.value.todayNormals)
const emergencyRate = computed(() => (alarmTotal.value ? Math.round((summary.value.todayEmergencies / alarmTotal.value) * 100) : 0))
const normalRate = computed(() => (alarmTotal.value ? 100 - emergencyRate.value : 0))
const ringStyle = computed(() => ({
  background: `conic-gradient(#ef4444 0 ${emergencyRate.value}%, #22c55e ${emergencyRate.value}% 100%)`,
}))

function buildPosition(seed: string): [number, number] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000
  }
  const lngOffset = (hash % 800) / 10000 - 0.04
  const latOffset = ((hash >> 4) % 600) / 10000 - 0.03
  return [112.561 + lngOffset, 37.87 + latOffset]
}

function loadAmap(): Promise<void> {
  if (amapPromise) {
    return amapPromise
  }
  amapPromise = new Promise((resolve, reject) => {
    const win = window as any
    if (win.AMap) {
      resolve()
      return
    }
    if (!amapKey) {
      reject(new Error('AMap key missing'))
      return
    }
    if (amapSecurityCode) {
      win._AMapSecurityConfig = {
        securityJsCode: amapSecurityCode,
      }
    }
    const callback = `amapInit_${Date.now()}`
    win[callback] = () => {
      resolve()
      delete win[callback]
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&callback=${callback}`
    script.onerror = () => reject(new Error('AMap load failed'))
    document.head.appendChild(script)
  })
  return amapPromise
}

async function initMap() {
  if (!mapRef.value) {
    return
  }
  mapError.value = ''
  try {
    await loadAmap()
  } catch {
    mapError.value = '地图加载失败，请检查高德 Key 类型与域名白名单'
    return
  }
  const AMap = (window as any).AMap
  try {
    mapInstance = new AMap.Map(mapRef.value, {
      zoom: 12,
      center: [112.561, 37.87],
      viewMode: '2D',
    })
  } catch {
    mapError.value = '地图初始化失败，请检查高德 Key 是否为 Web JS API'
    return
  }
}

function renderMapMarkers() {
  if (!mapInstance) {
    return
  }
  const AMap = (window as any).AMap
  if (mapMarkers.length) {
    mapInstance.remove(mapMarkers)
  }
  mapMarkers = mapPoints.value.map((point) => {
    const isAbnormal = point.icon === warnHomeIcon
    const marker = new AMap.Marker({
      position: point.position,
      content: buildMarkerContent(point.icon, isAbnormal),
      offset: new AMap.Pixel(-20, -40),
    })
    marker.setLabel({
      content: `<div class="map-marker ${point.status.toLowerCase()}">${point.name}</div>`,
      direction: 'top',
      offset: new AMap.Pixel(0, -10),
    })
    marker.on('click', () => openPoint(point))
    return marker
  })
  mapInstance.add(mapMarkers)
}

onMounted(async () => {
  await loadSummary()
  await initMap()
  renderMapMarkers()
  pollTimer = setInterval(() => {
    void refreshDeviceSummarySilently()
    void refreshAlarmSummarySilently()
  }, DASHBOARD_POLL_INTERVAL_MS)
})

watch(mapPoints, () => {
  renderMapMarkers()
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="dashboard">
    <div ref="mapRef" class="map-canvas" />
    <div v-if="activeAlarm" class="alarm-red-glow" />
    <div v-if="mapError" class="map-error">{{ mapError }}</div>
    
    <div class="map-legend">
      <div class="map-legend-item">
        <img :src="healthHomeIcon" alt="正常设备" class="legend-icon" />
        正常设备
      </div>
      <div class="map-legend-item">
        <img :src="warnHomeIcon" alt="不正常设备" class="legend-icon" />
        不正常设备
      </div>
      <div class="map-legend-item">
        <img :src="offlineHomeIcon" alt="不在线设备" class="legend-icon" />
        不在线设备
      </div>
    </div>

    <div class="floating-panel">
      <div class="stat-title">数据看板</div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-label">今日紧急</div>
          <div class="stat-value danger">{{ summary.todayEmergencies }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">今日一般</div>
          <div class="stat-value warning">{{ summary.todayNormals }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">总设备数</div>
          <div class="stat-value">{{ summary.totalDevices }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">在监护人数</div>
          <div class="stat-value">{{ summary.monitoringCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">在线设备</div>
          <div class="stat-value success">{{ summary.onlineDevices }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">离线设备</div>
          <div class="stat-value muted">{{ summary.offlineDevices }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">待处理预约</div>
          <div class="stat-value">{{ summary.pendingOrders }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已完成预约</div>
          <div class="stat-value">{{ summary.completedOrders }}</div>
        </div>
      </div>
      <div class="alarm-section">
        <div class="alarm-section-title">
          今日告警分类
          <span v-if="summary.alarmUnhandled > 0" class="unhandled-badge">{{ summary.alarmUnhandled }} 待处理</span>
        </div>
        <div class="alarm-type-grid">
          <div class="alarm-type-item fall" @click="$router.push('/alarms')">
            <div class="alarm-type-count">{{ summary.alarmFall }}</div>
            <div class="alarm-type-label">跌倒</div>
          </div>
          <div class="alarm-type-item heart" @click="$router.push('/alarms')">
            <div class="alarm-type-count">{{ summary.alarmHeartRate }}</div>
            <div class="alarm-type-label">心率异常</div>
          </div>
          <div class="alarm-type-item breath" @click="$router.push('/alarms')">
            <div class="alarm-type-count">{{ summary.alarmBreathRate }}</div>
            <div class="alarm-type-label">呼吸异常</div>
          </div>
          <div class="alarm-type-item offline" @click="$router.push('/alarms')">
            <div class="alarm-type-count">{{ summary.alarmDeviceOffline }}</div>
            <div class="alarm-type-label">设备离线</div>
          </div>
        </div>
      </div>

      <div class="ring-card">
        <div class="ring" :style="ringStyle">
          <div class="ring-center">
            <div class="ring-value">{{ alarmTotal }}</div>
            <div class="ring-label">今日告警</div>
          </div>
        </div>
        <div class="ring-legend">
          <div class="legend-item"><span class="legend-dot danger" />紧急 {{ emergencyRate }}%</div>
          <div class="legend-item"><span class="legend-dot success" />一般 {{ normalRate }}%</div>
        </div>
      </div>
    </div>

    <el-dialog v-model="pointDialogVisible" title="点位详情" width="480px">
      <el-descriptions :column="1" border>
        <el-descriptions-item v-for="(value, key) in currentPointDetail" :key="key" :label="key">
          {{ value }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <div v-if="activeAlarm" class="alarm-dialog-wrap">
      <div class="alarm-dialog-card">
        <div class="alarm-dialog-eyebrow">家庭报警</div>
        <div class="alarm-dialog-title">请确认本条家庭报警处理结果</div>
        <div class="alarm-dialog-grid">
          <div class="alarm-dialog-row">
            <span class="alarm-dialog-key">报警类型</span>
            <strong class="alarm-dialog-value">{{ activeAlarm.typeLabel }}</strong>
          </div>
          <div class="alarm-dialog-row">
            <span class="alarm-dialog-key">告警级别</span>
            <strong class="alarm-dialog-value">{{ activeAlarm.levelLabel }}</strong>
          </div>
          <div class="alarm-dialog-row">
            <span class="alarm-dialog-key">监护对象</span>
            <strong class="alarm-dialog-value">{{ activeAlarm.targetName }}</strong>
          </div>
          <div class="alarm-dialog-row">
            <span class="alarm-dialog-key">设备号</span>
            <strong class="alarm-dialog-value">{{ activeAlarm.deviceId || '-' }}</strong>
          </div>
          <div class="alarm-dialog-row alarm-dialog-row-full">
            <span class="alarm-dialog-key">家庭地址</span>
            <strong class="alarm-dialog-value">{{ activeAlarm.address }}</strong>
          </div>
          <div class="alarm-dialog-row alarm-dialog-row-full">
            <span class="alarm-dialog-key">报警时间</span>
            <strong class="alarm-dialog-value">{{ dayjs(activeAlarm.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}</strong>
          </div>
        </div>

        <div class="alarm-result-label">处理结果</div>
        <div class="alarm-result-options">
          <button
            type="button"
            class="alarm-result-option"
            :class="{ selected: selectedAlarmResult === 'HANDLED' }"
            @click="selectedAlarmResult = 'HANDLED'"
          >
            已处理
          </button>
          <button
            type="button"
            class="alarm-result-option"
            :class="{ selected: selectedAlarmResult === 'IGNORED' }"
            @click="selectedAlarmResult = 'IGNORED'"
          >
            已忽略
          </button>
        </div>

        <button
          type="button"
          class="alarm-submit-btn"
          :disabled="!selectedAlarmResult || isSubmittingAlarm"
          @click="submitDashboardAlarm"
        >
          {{ isSubmittingAlarm ? '提交中...' : '关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.device-marker {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.marker-icon {
  width: 40px;
  height: 40px;
  display: block;
  z-index: 2;
  position: relative;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(245, 108, 108, 0.4);
  box-shadow: 0 0 10px rgba(245, 108, 108, 0.8);
  animation: pulse-ring 2s infinite;
  z-index: 1;
}

@keyframes pulse-ring {
  0% {
    width: 80%;
    height: 80%;
    opacity: 1;
  }
  100% {
    width: 200%;
    height: 200%;
    opacity: 0;
  }
}
</style>

<style scoped>
.dashboard {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.alarm-red-glow {
  position: absolute;
  inset: -12%;
  background: radial-gradient(circle at center, rgba(239, 68, 68, 0.36), rgba(239, 68, 68, 0.16) 42%, rgba(239, 68, 68, 0) 76%);
  animation: dashboard-alarm-glow 1.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 11;
}

@keyframes dashboard-alarm-glow {
  0%, 100% {
    opacity: 0.58;
    transform: scale(1);
  }
  50% {
    opacity: 0.96;
    transform: scale(1.04);
  }
}

.alarm-dialog-wrap {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
}

.alarm-dialog-card {
  width: min(440px, calc(100vw - 48px));
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 80px rgba(127, 29, 29, 0.24);
  border: 1px solid rgba(254, 202, 202, 0.86);
  padding: 24px;
  pointer-events: auto;
}

.alarm-dialog-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #dc2626;
}

.alarm-dialog-title {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  color: #111827;
}

.alarm-dialog-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.alarm-dialog-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.alarm-dialog-row-full {
  grid-column: 1 / -1;
}

.alarm-dialog-key {
  font-size: 12px;
  color: #6b7280;
}

.alarm-dialog-value {
  font-size: 15px;
  color: #0f172a;
  line-height: 1.4;
}

.alarm-result-label {
  margin-top: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.alarm-result-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.alarm-result-option {
  height: 44px;
  border: 1px solid #fecaca;
  border-radius: 14px;
  background: #fff5f5;
  color: #991b1b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.alarm-result-option:hover {
  transform: translateY(-1px);
}

.alarm-result-option.selected {
  border-color: #dc2626;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  box-shadow: 0 12px 30px rgba(220, 38, 38, 0.28);
}

.alarm-submit-btn {
  margin-top: 18px;
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #111827, #1f2937);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.alarm-submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.alarm-submit-btn:not(:disabled):hover {
  transform: translateY(-1px);
}

.map-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.map-error {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  font-size: 14px;
  z-index: 10;
}

.map-legend {
  position: absolute;
  bottom: 24px;
  left: 24px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #475569;
  z-index: 5;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.legend-dot.online { background: #22c55e; }
.legend-dot.offline { background: #f59e0b; }
.legend-dot.disabled { background: #94a3b8; }
.legend-dot.danger { background: #ef4444; }
.legend-dot.success { background: #22c55e; }

.floating-panel {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 320px;
  padding: 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.danger { color: #ef4444; }
.stat-value.warning { color: #f59e0b; }
.stat-value.success { color: #22c55e; }
.stat-value.muted { color: #94a3b8; }

.alarm-section {
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  padding-top: 14px;
}

.alarm-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.unhandled-badge {
  background: #fef2f2;
  color: #ef4444;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #fecaca;
  animation: badge-blink 2s ease-in-out infinite;
}

@keyframes badge-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.alarm-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.alarm-type-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s;
}

.alarm-type-item:hover {
  transform: translateY(-2px);
}

.alarm-type-item.fall { background: #fef2f2; }
.alarm-type-item.heart { background: #fff7ed; }
.alarm-type-item.breath { background: #eff6ff; }
.alarm-type-item.offline { background: #f8fafc; }

.alarm-type-icon {
  font-size: 18px;
  line-height: 1;
}

.alarm-type-count {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: #0f172a;
}

.alarm-type-item.fall .alarm-type-count { color: #ef4444; }
.alarm-type-item.heart .alarm-type-count { color: #f97316; }
.alarm-type-item.breath .alarm-type-count { color: #3b82f6; }
.alarm-type-item.offline .alarm-type-count { color: #94a3b8; }

.alarm-type-label {
  font-size: 11px;
  color: #64748b;
}

.ring-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid rgba(226, 232, 240, 0.6);
}

.ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.ring-center {
  width: 84px;
  height: 84px;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.ring-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}

.ring-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.ring-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
}

@media (max-width: 1024px) {
  .floating-panel {
    display: none; /* Hide on small screens or adjust */
  }

  .alarm-dialog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
