<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { dataApi, deviceApi } from '@/api/modules'
import { deviceStatusLabelMap, deviceTypeLabelMap } from '@/constants/dicts'
import type { Device, DeviceLog } from '@/types'
import {
  getDefaultZoomStart,
  getFirstNumericMetricValue,
  maxChartPointCount,
  sampleRowsForChart,
  type ChartMetricDefinition,
} from '@/utils/chart-density'

const route = useRoute()
const router = useRouter()
const deviceId = route.params.id as string

const loading = ref(false)
const messageLoading = ref(false)
const historyLoading = ref(false)
const fullHistoryLoading = ref(false)
const device = ref<Device | null>(null)
const logs = ref<DeviceLog[]>([])
const recentHistory = ref<Record<string, unknown>[]>([])
const fullHistory = ref<Record<string, unknown>[]>([])
const chartRef = ref<HTMLElement | null>(null)
const chartKeys = ref<string[]>([])
const selectedMetricIds = ref<string[]>(['heartRate', 'breathRate'])
let chart: echarts.ECharts | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
const autoRefreshIntervalMs = 15000

const fullHistoryDialogVisible = ref(false)
const activeMetric = ref('')
const historySource = ref<'tdengine' | 'logs' | 'none'>('none')

const CHART_METRICS: ChartMetricDefinition[] = [
  {
    id: 'heartRate',
    label: '心率',
    unit: 'bpm',
    keys: ['heart_rate_per_min', 'heart_rate', 'heartRate'],
    color: '#f59e0b',
  },
  {
    id: 'breathRate',
    label: '呼吸率',
    unit: '次/分',
    keys: ['breath_rate_per_min', 'breath_rate', 'breathRate'],
    color: '#10b981',
  },
]

const FIELD_LABEL_MAP: Record<string, string> = {
  device_id: '设备ID',
  deviceId: '设备ID',
  timestamp: '采集时间',
  collectTime: '采集时间',
  heart_rate_per_min: '心率',
  breath_rate_per_min: '呼吸率',
  heart_rate: '心率',
  breath_rate: '呼吸率',
  heartRate: '心率',
  breathRate: '呼吸率',
  battery: '电量',
  is_fall: '跌倒',
  fall_status: '跌倒',
  fall_state: '跌倒',
  fallState: '跌倒',
  is_person_present: '有人',
  presence: '有人',
  is_person: '有人',
  stationary: '静止',
  lat: '纬度',
  lng: '经度',
  speed: '速度',
}

const parsedMessages = computed(() => {
  return logs.value.map((log) => {
    const payload = parseJson(log.content)
    const parsedFields = parseMessageFields(payload)
    return {
      id: log.id,
      occurredAt: log.occurredAt,
      logType: log.logType,
      summary: buildMessageSummary(payload),
      parsedText: parsedFields.map((item) => `${item.label}:${item.value}`).join('，') || '-',
      payload,
      content: log.content,
    }
  })
})

const metricRows = computed(() => {
  if (!activeMetric.value) {
    return []
  }
  return fullHistory.value
    .filter((row) => row[activeMetric.value] !== undefined && row[activeMetric.value] !== null)
    .map((row) => ({
      ts: formatTime(row.ts),
      value: stringifyValue(row[activeMetric.value]),
    }))
})

const availableChartMetrics = computed(() => {
  return CHART_METRICS.filter((metric) => {
    return recentHistory.value.some((row) => getFirstNumericMetricValue(row, metric) !== null)
  })
})

const activeChartMetrics = computed(() => {
  const availableIds = new Set(availableChartMetrics.value.map((metric) => metric.id))
  return CHART_METRICS.filter((metric) => selectedMetricIds.value.includes(metric.id) && availableIds.has(metric.id))
})

const chartPointSummary = computed(() => {
  const total = recentHistory.value.length
  if (total <= maxChartPointCount) {
    return total ? `共 ${total} 个点` : '暂无数据点'
  }
  return `共 ${total} 个点，图表抽样显示约 ${maxChartPointCount} 个点`
})

const historySourceText = computed(() => {
  if (historySource.value === 'tdengine') {
    return '数据来源：时序库'
  }
  if (historySource.value === 'logs') {
    return '数据来源：消息日志回退'
  }
  return '数据来源：暂无'
})

const latestStatus = computed(() => {
  if (!recentHistory.value.length) {
    return { isFall: '-', isPersonPresent: '-' }
  }
  const last = recentHistory.value[recentHistory.value.length - 1]
  
  if (!last) {
    return { isFall: '-', isPersonPresent: '-' }
  }

  // Helper to find value by multiple possible keys
  const findValue = (keys: string[]) => {
    for (const k of keys) {
      if (last[k] !== undefined && last[k] !== null) return last[k]
    }
    return undefined
  }

  const fallVal = findValue(['is_fall', 'fall_status', 'fall_state', 'fallState'])
  const presenceVal = findValue(['is_person_present', 'is_person', 'presence'])

  const formatBool = (v: any) => {
    if (v === undefined) return '-'
    if (typeof v === 'boolean') return v ? '是' : '否'
    if (typeof v === 'number') return v === 1 ? '是' : '否'
    return String(v)
  }

  return {
    isFall: formatBool(fallVal),
    isPersonPresent: formatBool(presenceVal),
  }
})

const recentSampleRows = computed(() => {
  return recentHistory.value
    .slice(-6)
    .reverse()
    .map((row) => ({
      ts: formatTime(row.ts),
      breathRate: getMetricValue(row, ['breath_rate_per_min', 'breath_rate', 'breathRate']),
      heartRate: getMetricValue(row, ['heart_rate_per_min', 'heart_rate', 'heartRate']),
      status: latestStatus.value.isFall === '是' ? '异常' : '正常',
    }))
})

const wardSections = computed(() => {
  if (!device.value?.wards?.length) {
    return [
      { memberId: 0, name: device.value?.targetName || '默认监护对象' },
    ]
  }
  return device.value.wards
})

const latestVitals = computed(() => {
  const latest = recentSampleRows.value[0]
  if (!latest) {
    return { heartRate: '-', breathRate: '-', sampledAt: '-' }
  }
  return {
    heartRate: latest.heartRate,
    breathRate: latest.breathRate,
    sampledAt: latest.ts,
  }
})

const deviceStatusTagType = computed(() => {
  if (!device.value) {
    return 'info'
  }
  if (device.value.status === 'ONLINE') {
    return 'success'
  }
  if (device.value.status === 'OFFLINE') {
    return 'danger'
  }
  return 'info'
})

const summaryCards = computed(() => ([
  {
    label: '设备状态',
    value: device.value ? deviceStatusLabelMap[device.value.status] : '-',
    hint: `设备号 ${device.value?.deviceId || '-'}`,
    tone: deviceStatusTagType.value,
  },
  {
    label: '最近在线',
    value: formatTime(device.value?.lastOnlineAt),
    hint: '在线活跃时间',
    tone: 'primary',
  },
  {
    label: '最新心率',
    value: latestVitals.value.heartRate === '-' ? '-' : `${latestVitals.value.heartRate} bpm`,
    hint: `采样 ${latestVitals.value.sampledAt}`,
    tone: 'warning',
  },
  {
    label: '最新呼吸',
    value: latestVitals.value.breathRate === '-' ? '-' : `${latestVitals.value.breathRate} 次/分`,
    hint: `跌倒 ${latestStatus.value.isFall} · 有人 ${latestStatus.value.isPersonPresent}`,
    tone: 'success',
  },
]))

function bindChartRef(el: unknown) {
  chartRef.value = el instanceof HTMLElement ? el : null
}

function formatTime(value: unknown) {
  if (!value) {
    return '-'
  }
  const ts = parseTimestamp(value)
  if (!Number.isFinite(ts)) {
    return String(value)
  }
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

function parseTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === 'number') {
    return value
  }
  const text = String(value || '')
  // Plain datetime strings without timezone suffix (from device payloads / TDengine) are UTC.
  // Append 'Z' so dayjs converts them to local time correctly.
  const normalized = /^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)
    ? text.replace(' ', 'T') + 'Z'
    : text
  const parsed = dayjs(normalized)
  if (!parsed.isValid()) {
    return Number.NaN
  }
  return parsed.valueOf()
}

function parseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

function stringifyValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  if (value == null) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function getMetricValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number') {
      return value.toFixed(1)
    }
    if (typeof value === 'string') {
      const num = Number(value)
      if (Number.isFinite(num)) {
        return num.toFixed(1)
      }
    }
  }
  return '-'
}

function normalizeHistoryRows(rows: Record<string, unknown>[]) {
  const metricKeys = [
    'heart_rate_per_min',
    'heart_rate',
    'heartRate',
    'breath_rate_per_min',
    'breath_rate',
    'breathRate',
    'fall_state',
    'fallState',
    'is_fall',
    'fall_status',
    'is_person_present',
    'is_person',
    'presence',
  ]
  return rows.map((row) => {
    const normalized: Record<string, unknown> = { ...row }
    normalized.ts = row.ts ?? row.timestamp ?? row.collectTime ?? row.occurredAt ?? null
    // Normalize TDengine column names to frontend aliases
    if (normalized.heart_rate !== undefined && normalized.heartRate === undefined) {
      normalized.heartRate = normalized.heart_rate
      normalized.heart_rate_per_min = normalized.heart_rate
    }
    if (normalized.breath_rate !== undefined && normalized.breathRate === undefined) {
      normalized.breathRate = normalized.breath_rate
      normalized.breath_rate_per_min = normalized.breath_rate
    }
    if (normalized.is_person !== undefined && normalized.is_person_present === undefined) {
      normalized.is_person_present = normalized.is_person
    }
    metricKeys.forEach((key) => {
      const value = normalized[key]
      if (typeof value === 'string') {
        const text = value.trim().toLowerCase()
        if (text === 'true') {
          normalized[key] = true
          return
        }
        if (text === 'false') {
          normalized[key] = false
          return
        }
        const num = Number(value)
        if (Number.isFinite(num)) {
          normalized[key] = num
        }
      }
    })
    return normalized
  })
}

function buildMessageSummary(payload: Record<string, unknown> | null) {
  if (!payload) {
    return '消息无法解析为 JSON'
  }
  const normalized = normalizePayload(payload)
  const keys = Object.keys(normalized)
  return keys.join('、') || '-'
}

function normalizePayload(payload: Record<string, unknown>) {
  if (payload.params && typeof payload.params === 'object') {
    return payload.params as Record<string, unknown>
  }
  if (payload.health_data && typeof payload.health_data === 'object') {
    const root = { ...payload }
    delete root.health_data
    return { ...root, ...(payload.health_data as Record<string, unknown>) }
  }
  return payload
}

function parseMessageFields(payload: Record<string, unknown> | null) {
  if (!payload) {
    return []
  }
  const normalized = normalizePayload(payload)
  const preferredOrder = [
    'device_id', 'deviceId', 'timestamp', 'collectTime',
    'heart_rate_per_min', 'heart_rate', 'heartRate', 'breath_rate_per_min', 'breath_rate', 'battery',
    'is_fall', 'fall_status', 'fall_state', 'fallState', 'is_person_present', 'is_person', 'presence', 'stationary',
    'lat', 'lng', 'speed',
  ]
  const keys = Object.keys(normalized)
  const orderedKeys = preferredOrder.filter((key) => keys.includes(key))
  const otherKeys = keys.filter((key) => !preferredOrder.includes(key))
  return [...orderedKeys, ...otherKeys].map((key) => ({
    label: FIELD_LABEL_MAP[key] || key,
    value: formatParsedFieldValue(key, normalized[key]),
  }))
}

function formatParsedFieldValue(key: string, value: unknown) {
  if (key === 'timestamp' || key === 'collectTime') {
    return formatTime(value)
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  if (key === 'fallState' && typeof value === 'number') {
    return value === 1 ? '是' : '否'
  }
  if (value == null) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function buildHistoryFromLogs(maxRows = 300) {
  const rows = logs.value
    .slice()
    .sort((a, b) => {
      const left = parseTimestamp(a.occurredAt)
      const right = parseTimestamp(b.occurredAt)
      const safeLeft = Number.isFinite(left) ? left : 0
      const safeRight = Number.isFinite(right) ? right : 0
      return safeLeft - safeRight
    })
    .map((log) => {
      const payload = parseJson(log.content)
      if (!payload) {
        return null
      }
      const normalized = normalizePayload(payload)
      const ts = normalized.timestamp ?? normalized.collectTime ?? log.occurredAt
      const row: Record<string, unknown> = { ts }
      Object.entries(normalized).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') {
          row[key] = value
        }
      })
      if (Object.keys(row).length <= 1) {
        return null
      }
      return row
    })
    .filter((item): item is Record<string, unknown> => !!item)
  if (rows.length <= maxRows) {
    return rows
  }
  return rows.slice(rows.length - maxRows)
}

function renderHistoryChart() {
  if (!chartRef.value) {
    return
  }
  syncSelectedMetricsWithAvailable()
  const metrics = activeChartMetrics.value
  chartKeys.value = metrics.map((metric) => metric.keys[0] ?? metric.id)

  if (!chart) {
    chart = echarts.init(chartRef.value)
    chart.on('click', (params: any) => {
      if (params.componentType !== 'series' || params.seriesIndex == null) {
        return
      }
      const key = chartKeys.value[params.seriesIndex]
      if (key) {
        void openFullHistory(key)
      }
    })
  }
  const chartRows = sampleRowsForChart(recentHistory.value)
  const zoomStart = getDefaultZoomStart(chartRows)
  const xAxis = chartRows.map((row) => formatTime(row.ts))
  const series = metrics.map((metric) => ({
    name: `${metric.label}${metric.unit ? `（${metric.unit}）` : ''}`,
    originalKey: metric.keys[0] ?? metric.id,
    type: 'line',
    smooth: true,
    showSymbol: chartRows.length <= 80,
    symbolSize: 5,
    connectNulls: false,
    sampling: 'lttb',
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' },
    itemStyle: { color: metric.color },
    data: chartRows.map((row) => getFirstNumericMetricValue(row, metric)),
  }))
  chart.setOption({
    color: metrics.map((metric) => metric.color),
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'line' },
    },
    legend: { type: 'scroll', top: 0, right: 8 },
    grid: { left: 36, right: 24, top: 42, bottom: 58, containLabel: true },
    xAxis: {
      type: 'category',
      data: xAxis,
      boundaryGap: false,
      axisLabel: {
        hideOverlap: true,
        formatter: (value: string) => {
          const parsed = dayjs(value)
          return parsed.isValid() ? parsed.format('HH:mm') : value.slice(11, 16)
        },
      },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { type: 'dashed' } } },
    dataZoom: [
      { type: 'inside', start: zoomStart, end: 100, minSpan: 5 },
      { type: 'slider', height: 22, bottom: 18, start: zoomStart, end: 100, brushSelect: false },
    ],
    series,
  }, true)
}

function syncSelectedMetricsWithAvailable() {
  const availableIds = availableChartMetrics.value.map((metric) => metric.id)
  selectedMetricIds.value = selectedMetricIds.value.filter((id) => availableIds.includes(id))
  if (!selectedMetricIds.value.length && availableIds.length) {
    selectedMetricIds.value = availableIds.slice(0, 2)
  }
}

async function handleChartMetricChange() {
  await nextTick()
  renderHistoryChart()
}

async function loadDevice(silent = false) {
  if (!silent) {
    loading.value = true
  }
  try {
    const list = await deviceApi.list()
    const found = list.find((item) => item.deviceId === deviceId)
    if (!found) {
      ElMessage.error('未找到该设备')
      router.push('/devices')
      return
    }
    device.value = found
  } catch {
    ElMessage.error('加载设备详情失败')
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

async function loadMessages(silent = false) {
  if (!silent) {
    messageLoading.value = true
  }
  try {
    logs.value = await deviceApi.logs(deviceId)
  } catch {
    ElMessage.error('加载设备消息失败')
  } finally {
    if (!silent) {
      messageLoading.value = false
    }
  }
}

async function loadRecentHistory(silent = false) {
  if (!silent) {
    historyLoading.value = true
  }
  try {
    const endTime = dayjs().toISOString()
    const startTime = dayjs().subtract(24, 'hour').toISOString()
    const result = await dataApi.history({ deviceId, startTime, endTime })
    recentHistory.value = normalizeHistoryRows(result.dataList || [])
    if (recentHistory.value.length) {
      historySource.value = 'tdengine'
    } else {
      const fallback = buildHistoryFromLogs()
      recentHistory.value = fallback
      historySource.value = fallback.length ? 'logs' : 'none'
    }
    await nextTick()
    renderHistoryChart()
  } catch {
    const fallback = buildHistoryFromLogs()
    recentHistory.value = fallback
    historySource.value = fallback.length ? 'logs' : 'none'
    await nextTick()
    renderHistoryChart()
  } finally {
    if (!silent) {
      historyLoading.value = false
    }
  }
}

async function openFullHistory(metric: string) {
  if (!device.value) {
    return
  }
  activeMetric.value = metric
  if (!fullHistory.value.length) {
    fullHistoryLoading.value = true
    try {
      const startTime = dayjs(device.value.createdAt || dayjs().subtract(30, 'day')).toISOString()
      const endTime = dayjs().toISOString()
      const result = await dataApi.history({ deviceId, startTime, endTime })
      fullHistory.value = normalizeHistoryRows(result.dataList || [])
    } catch {
      fullHistory.value = []
      ElMessage.error('加载全量历史失败')
    } finally {
      fullHistoryLoading.value = false
    }
  }
  fullHistoryDialogVisible.value = true
}

async function clearDataRecords() {
  try {
    await ElMessageBox.confirm('确认清空该设备的所有数据记录吗？该操作不可恢复。', '警告', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    await dataApi.clearData(deviceId)
    ElMessage.success('数据记录已清空')
    recentHistory.value = []
    fullHistory.value = []
    logs.value = []
    historySource.value = 'none'
    await nextTick()
    renderHistoryChart()
  } catch {
    // Cancelled
  }
}

async function refreshAll() {
  await loadDevice()
  await loadMessages()
  await loadRecentHistory()
}

async function refreshSilently() {
  await loadDevice(true)
  await loadMessages(true)
  await loadRecentHistory(true)
}

onMounted(async () => {
  if (!deviceId) {
    return
  }
  const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
  if (!DEVICE_ID_RE.test(deviceId)) {
    ElMessage.error(`设备ID格式不合法: ${deviceId}`)
    router.replace('/devices')
    return
  }
  await refreshAll()
  refreshTimer = setInterval(() => {
    refreshSilently()
  }, autoRefreshIntervalMs)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<template>
  <div v-loading="loading" class="device-detail">

    <el-card class="mt-4 section-card overview-card">
      <div class="overview-head">
        <div>
          <div class="overview-title">设备运行概览</div>
          <div class="overview-subtitle">关键状态与最新生命体征</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <el-tag :type="deviceStatusTagType">{{ device ? deviceStatusLabelMap[device.status] : '-' }}</el-tag>
          <el-button type="danger" plain size="small" @click="clearDataRecords">清空数据记录</el-button>
        </div>
      </div>
      <div class="summary-grid">
        <div v-for="item in summaryCards" :key="item.label" class="summary-item" :class="`tone-${item.tone}`">
          <div class="summary-label">{{ item.label }}</div>
          <div class="summary-value">{{ item.value }}</div>
          <div class="summary-hint">{{ item.hint }}</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="device" class="mt-4 section-card">
      <template #header>
        <div class="card-header">
          <span>基本信息</span>
          <span class="card-header-sub">设备主体信息</span>
        </div>
      </template>
      <div class="form-grid">
        <div class="field-item"><span class="field-label">设备号</span><span class="field-value">{{ device.deviceId }}</span></div>
        <div class="field-item"><span class="field-label">设备型号</span><span class="field-value">{{ deviceTypeLabelMap[device.deviceType] }}</span></div>
        <div class="field-item"><span class="field-label">激活时间</span><span class="field-value">{{ formatTime(device.createdAt) }}</span></div>
      </div>
    </el-card>

    <el-card v-if="device" class="mt-4 section-card">
      <template #header>
        <div class="card-header">
          <span>绑定家庭信息</span>
          <span class="card-header-sub">联系人与家庭位置</span>
        </div>
      </template>
      <div class="form-grid">
        <div class="field-item wide"><span class="field-label">地址</span><span class="field-value">{{ device.address || '-' }}</span></div>
        <div class="field-item"><span class="field-label">联系人</span><span class="field-value">{{ device.guardian?.name || '-' }}</span></div>
        <div class="field-item"><span class="field-label">联系电话</span><span class="field-value">{{ device.guardian?.mobile || '-' }}</span></div>
        <div class="field-item"><span class="field-label">门牌号</span><span class="field-value">{{ device.roomNumber || '-' }}</span></div>
        <div class="field-item"><span class="field-label">所属区划</span><span class="field-value">{{ device.homeLocation || '-' }}</span></div>
        <div class="field-item"><span class="field-label">备注</span><span class="field-value">-</span></div>
      </div>
    </el-card>

    <el-card class="mt-4 section-card" v-loading="historyLoading">
      <template #header>
        <div class="card-header">
          <span>监护对象及历史数据</span>
          <span class="card-header-sub">{{ historySourceText }}</span>
        </div>
      </template>
      <div v-for="(ward, index) in wardSections" :key="ward.memberId" class="ward-section">
        <div class="form-grid">
          <div class="field-item"><span class="field-label">成员</span><span class="field-value">{{ ward.name }}</span></div>
          <div class="field-item"><span class="field-label">联系电话</span><span class="field-value">{{ device?.guardian?.mobile || '-' }}</span></div>
          <div class="field-item"><span class="field-label">年龄</span><span class="field-value">-</span></div>
          <div class="field-item"><span class="field-label">是否跌倒</span><span class="field-value">{{ latestStatus.isFall }}</span></div>
          <div class="field-item"><span class="field-label">是否有人</span><span class="field-value">{{ latestStatus.isPersonPresent }}</span></div>
          <div class="field-item"><span class="field-label">数据来源</span><span class="field-value">{{ historySourceText }}</span></div>
        </div>
        <div class="history-pane">
          <div class="history-chart">
            <div v-if="recentHistory.length && index === 0">
              <div class="chart-toolbar">
                <div class="chart-toolbar-main">
                  <span class="chart-toolbar-title">趋势图</span>
                  <span class="chart-toolbar-sub">{{ chartPointSummary }}</span>
                </div>
                <el-checkbox-group v-model="selectedMetricIds" size="small" @change="handleChartMetricChange">
                  <el-checkbox-button
                    v-for="metric in availableChartMetrics"
                    :key="metric.id"
                    :label="metric.id"
                  >
                    {{ metric.label }}
                  </el-checkbox-button>
                </el-checkbox-group>
              </div>
              <div v-if="activeChartMetrics.length" :ref="bindChartRef" class="chart" />
              <el-empty v-else description="暂无可展示指标" />
            </div>
            <div v-else-if="recentHistory.length" class="chart-placeholder">同设备实时曲线</div>
            <el-empty v-else description="暂无历史数据" />
          </div>
          <div class="history-list">
            <el-table :data="recentSampleRows" height="260" size="small">
              <el-table-column prop="ts" label="时间" min-width="130" />
              <el-table-column prop="breathRate" label="呼吸" width="80" />
              <el-table-column prop="heartRate" label="心率" width="80" />
              <el-table-column prop="status" label="状态" width="70">
                <template #default="{ row }">
                  <el-tag :type="row.status === '正常' ? 'success' : 'danger'">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </el-card>

    <el-card v-if="device" class="mt-4 section-card">
      <template #header>
        <div class="card-header">
          <span>医疗信息</span>
          <span class="card-header-sub">机构与监护对象关联</span>
        </div>
      </template>
      <div class="form-grid">
        <div class="field-item"><span class="field-label">医疗机构</span><span class="field-value">{{ device.medicalInstitution || '-' }}</span></div>
        <div class="field-item"><span class="field-label">监护对象ID</span><span class="field-value">{{ device.targetId ?? '-' }}</span></div>
        <div class="field-item"><span class="field-label">最近在线</span><span class="field-value">{{ formatTime(device.lastOnlineAt) }}</span></div>
      </div>
    </el-card>

    <el-card v-if="device" class="mt-4 section-card">
      <template #header>
        <div class="card-header">
          <span>物业信息</span>
          <span class="card-header-sub">地址坐标信息</span>
        </div>
      </template>
      <div class="form-grid">
        <div class="field-item"><span class="field-label">物业名称</span><span class="field-value">{{ device.propertyManagement || '-' }}</span></div>
        <div class="field-item"><span class="field-label">经度</span><span class="field-value">{{ device.longitude ?? '-' }}</span></div>
        <div class="field-item"><span class="field-label">纬度</span><span class="field-value">{{ device.latitude ?? '-' }}</span></div>
      </div>
    </el-card>

    <el-card class="mt-4 section-card" v-loading="messageLoading">
      <template #header>
        <div class="card-header">
          <span>设备消息解析</span>
          <span class="card-header-sub">原始消息结构化结果</span>
        </div>
      </template>
      <el-table :data="parsedMessages" height="320" stripe>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
        </el-table-column>
        <el-table-column prop="logType" label="类型" width="120" />
        <el-table-column prop="parsedText" label="解析结果" min-width="260" show-overflow-tooltip />
      </el-table>
    </el-card>

    <el-dialog
      v-model="fullHistoryDialogVisible"
      :title="`指标历史：${FIELD_LABEL_MAP[activeMetric] || activeMetric || '-'}`"
      width="780px"
    >
      <el-table v-loading="fullHistoryLoading" :data="metricRows" height="500">
        <el-table-column prop="ts" label="时间" width="200" />
        <el-table-column prop="value" label="值" />
      </el-table>
      <el-empty v-if="!fullHistoryLoading && !metricRows.length" description="暂无该指标历史记录" />
    </el-dialog>

    <div class="close-bar">
      <el-button @click="router.back()">关闭</el-button>
    </div>
  </div>
</template>

<style scoped>
.device-detail {
  padding-bottom: 16px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mt-4 {
  margin-top: 16px;
}

.section-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
}

.card-header-sub {
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
}

.overview-card {
  background: linear-gradient(145deg, #f8fbff 0%, #ffffff 55%, #f5faff 100%);
}

.overview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.overview-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.overview-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.85);
}

.summary-item.tone-success {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(240, 253, 244, 0.9);
}

.summary-item.tone-danger {
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(254, 242, 242, 0.9);
}

.summary-item.tone-warning {
  border-color: rgba(245, 158, 11, 0.25);
  background: rgba(255, 251, 235, 0.9);
}

.summary-item.tone-primary {
  border-color: rgba(59, 130, 246, 0.25);
  background: rgba(239, 246, 255, 0.9);
}

.summary-label {
  color: #64748b;
  font-size: 12px;
}

.summary-value {
  margin-top: 4px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}

.summary-hint {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.2;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.field-item {
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  min-height: 42px;
}

.field-item.wide {
  grid-column: span 2;
}

.field-label {
  color: #6b7280;
  min-width: 80px;
  font-size: 13px;
}

.field-value {
  color: #111827;
  font-weight: 500;
  font-size: 13px;
}

.ward-section {
  border: 1px solid #eef2f7;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 14px;
}

.history-pane {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 12px;
  align-items: stretch;
}

.history-chart {
  border: 1px solid #eef2f7;
  border-radius: 6px;
  padding: 8px;
  min-height: 280px;
}

.history-list {
  border: 1px solid #eef2f7;
  border-radius: 6px;
  padding: 6px;
}

.chart-placeholder {
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 6px;
}

.chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.chart-toolbar-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.chart-toolbar-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.chart-toolbar-sub {
  color: #94a3b8;
  font-size: 12px;
}

.chart {
  height: 320px;
}

.close-bar {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .history-pane {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .field-item.wide {
    grid-column: span 1;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .chart-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
