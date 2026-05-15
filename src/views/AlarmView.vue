<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { alarmApi } from '@/api/modules'
import { alarmLevelLabelMap, alarmStatusLabelMap, alarmTypeLabelMap } from '@/constants/dicts'
import { exportJsonToExcel } from '@/utils/export'
import { useAuthStore } from '@/stores/auth'
import type { Alarm, AlarmHandleStatus, AlarmLevel, AlarmType } from '@/types'

const loading = ref(false)
const alarms = ref<Alarm[]>([])
const detailVisible = ref(false)
const selectedAlarm = ref<Alarm | null>(null)
const handleRemark = ref('')
const authStore = useAuthStore()
const page = ref(1)
const pageSize = ref(15)

const filters = reactive({
  region: '',
  dateRange: [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()] as [Date, Date],
  deviceOrTarget: '',
  targetId: '',
  alarmType: '' as '' | AlarmType,
  alarmLevel: '' as '' | AlarmLevel,
  handleStatus: '' as '' | AlarmHandleStatus,
})

const filtered = computed(() =>
  alarms.value.filter((item) => {
    const alarmTs = dayjs(item.alarmTime).valueOf()
    const inRange =
      alarmTs >= dayjs(filters.dateRange[0]).valueOf() &&
      alarmTs <= dayjs(filters.dateRange[1]).valueOf()
    const matchRegion = !filters.region || `区域-${String(item.targetId).slice(-1)}`.includes(filters.region)
    const matchDeviceOrTarget =
      !filters.deviceOrTarget ||
      item.deviceId.includes(filters.deviceOrTarget) ||
      String(item.targetId).includes(filters.deviceOrTarget)
    const matchTarget = !filters.targetId || String(item.targetId).includes(filters.targetId)
    const matchAlarmType = !filters.alarmType || item.alarmType === filters.alarmType
    const matchAlarmLevel = !filters.alarmLevel || item.alarmLevel === filters.alarmLevel
    const matchHandleStatus = !filters.handleStatus || item.handleStatus === filters.handleStatus
    return inRange && matchRegion && matchDeviceOrTarget && matchTarget && matchAlarmType && matchAlarmLevel && matchHandleStatus
  }),
)

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

async function loadAlarms() {
  loading.value = true
  try {
    const userId = authStore.userInfo?.userId
    const role = authStore.userInfo?.role
    alarms.value = await alarmApi.list({
      guardianId: role === 'ADMIN' ? undefined : userId,
      startTime: dayjs(filters.dateRange[0]).toISOString(),
      endTime: dayjs(filters.dateRange[1]).toISOString(),
    })
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.region = ''
  filters.deviceOrTarget = ''
  filters.targetId = ''
  filters.alarmType = ''
  filters.alarmLevel = ''
  filters.handleStatus = ''
  filters.dateRange = [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()]
  page.value = 1
}

function viewDetail(alarm: Alarm) {
  selectedAlarm.value = alarm
  handleRemark.value = alarm.handleRemark || ''
  detailVisible.value = true
}

async function markHandled(alarm: Alarm) {
  await alarmApi.handle({
    alarmId: alarm.id,
    handleStatus: 'HANDLED',
    handlerId: authStore.userInfo?.userId ?? 0,
    handleRemark: handleRemark.value || '已处理',
  })
  ElMessage.success('已标记处理')
  await loadAlarms()
}

async function ignoreAlarm(alarm: Alarm) {
  await alarmApi.handle({
    alarmId: alarm.id,
    handleStatus: 'IGNORED',
    handlerId: authStore.userInfo?.userId ?? 0,
    handleRemark: '已忽略',
  })
  ElMessage.success('已忽略')
  await loadAlarms()
}

async function handleAll() {
  await ElMessageBox.confirm('将所有未处理告警标记为已处理，确认吗？', '一键处理', { type: 'warning' })
  const count = await alarmApi.handleAll(authStore.userInfo?.userId ?? 0)
  ElMessage.success(`已处理 ${count} 条告警`)
  await loadAlarms()
}

async function clearAll() {
  await ElMessageBox.confirm('将永久删除所有告警记录，此操作不可恢复，确认吗？', '清空记录', { type: 'warning', confirmButtonText: '确认清空', confirmButtonClass: 'el-button--danger' })
  await alarmApi.clearAll(authStore.userInfo?.userId)
  ElMessage.success('已清空所有告警记录')
  await loadAlarms()
}

function exportExcel() {
  exportJsonToExcel(
    '报警记录列表',
    filtered.value.map((item, index) => ({
      序号: index + 1,
      设备号: item.deviceId,
      监护对象ID: item.targetId,
      告警类型: alarmTypeLabelMap[item.alarmType],
      告警级别: alarmLevelLabelMap[item.alarmLevel],
      告警时间: dayjs(item.alarmTime).format('YYYY-MM-DD HH:mm:ss'),
      处理状态: alarmStatusLabelMap[item.handleStatus],
      处理人ID: item.handlerId ?? '-',
      处理时间: item.handleTime ? dayjs(item.handleTime).format('YYYY-MM-DD HH:mm:ss') : '-',
      所属区划: `区域-${String(item.targetId).slice(-1)}`,
    })),
  )
}

function alarmTypeText(value: AlarmType) {
  return alarmTypeLabelMap[value]
}

function alarmLevelText(value: AlarmLevel) {
  return alarmLevelLabelMap[value]
}

function alarmStatusText(value: AlarmHandleStatus) {
  return alarmStatusLabelMap[value]
}

onMounted(loadAlarms)
</script>

<template>
  <div class="page-wrap">
  <div class="page-header">
    <span class="page-title">告警管理</span>
    <div style="display:flex;gap:8px">
      <el-button type="primary" plain @click="handleAll">一键处理</el-button>
      <el-button type="danger" plain @click="clearAll">清空记录</el-button>
      <el-button link @click="exportExcel">导出 Excel</el-button>
    </div>
  </div>
  <el-card class="page-card">
    <div class="page-toolbar">
      <el-input v-model="filters.region" placeholder="所属区划" style="width: 130px" clearable />
      <el-date-picker
        v-model="filters.dateRange"
        type="datetimerange"
        range-separator="-"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        style="width: 330px"
      />
      <el-input v-model="filters.deviceOrTarget" placeholder="设备号/对象ID" style="width: 160px" clearable />
      <el-input v-model="filters.targetId" placeholder="监护对象ID" style="width: 150px" clearable />
      <el-select v-model="filters.alarmType" placeholder="告警类型" style="width: 130px" clearable>
        <el-option label="跌倒" value="FALL" />
        <el-option label="心率异常" value="HEART_RATE" />
        <el-option label="呼吸率异常" value="BREATH_RATE" />
        <el-option label="设备离线" value="DEVICE_OFFLINE" />
      </el-select>
      <el-select v-model="filters.alarmLevel" placeholder="告警级别" style="width: 120px" clearable>
        <el-option label="一般" value="NORMAL" />
        <el-option label="紧急" value="EMERGENCY" />
      </el-select>
      <el-select v-model="filters.handleStatus" placeholder="处理状态" style="width: 120px" clearable>
        <el-option label="未处理" value="UNHANDLED" />
        <el-option label="已处理" value="HANDLED" />
        <el-option label="已忽略" value="IGNORED" />
      </el-select>
      <el-button @click="resetFilters">重置</el-button>
      <el-button type="primary" @click="loadAlarms">查询</el-button>
    </div>

    <div class="legend-row">
      <el-tag effect="plain" type="danger">跌倒警报</el-tag>
      <el-tag effect="plain" type="warning">心率异常</el-tag>
      <el-tag effect="plain" type="info">设备离线</el-tag>
    </div>

    <el-table v-loading="loading" :data="pagedRows" border height="520">
      <el-table-column type="selection" width="46" />
      <el-table-column label="序号" width="60">
        <template #default="{ $index }">{{ (page - 1) * pageSize + $index + 1 }}</template>
      </el-table-column>
      <el-table-column prop="deviceId" label="设备号" min-width="120" />
      <el-table-column prop="targetId" label="监护对象ID" min-width="110" />
      <el-table-column label="告警类型" min-width="100">
        <template #default="{ row }">
          <el-tag
            :type="row.alarmType === 'FALL' ? 'danger' : row.alarmType === 'HEART_RATE' ? 'warning' : 'info'"
            size="small"
          >{{ alarmTypeText(row.alarmType as AlarmType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="告警级别" min-width="100">
        <template #default="{ row }">
          <el-tag :type="row.alarmLevel === 'EMERGENCY' ? 'danger' : 'warning'" size="small">
            {{ alarmLevelText(row.alarmLevel as AlarmLevel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="告警时间" min-width="165">
        <template #default="{ row }">{{ dayjs(row.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}</template>
      </el-table-column>
      <el-table-column label="处理状态" min-width="90">
        <template #default="{ row }">
          <el-tag :type="row.handleStatus === 'HANDLED' ? 'success' : row.handleStatus === 'IGNORED' ? 'info' : 'warning'">
            {{ alarmStatusText(row.handleStatus as AlarmHandleStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理人ID" min-width="90">
        <template #default="{ row }">{{ row.handlerId ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="处理时间" min-width="165">
        <template #default="{ row }">{{ row.handleTime ? dayjs(row.handleTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}</template>
      </el-table-column>
      <el-table-column label="所属区划" min-width="100">
        <template #default="{ row }">{{ `区域-${String(row.targetId).slice(-1)}` }}</template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
          <el-button link @click="markHandled(row)">标记处理</el-button>
          <el-button link type="danger" @click="ignoreAlarm(row)">忽略</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :page-sizes="[15, 30, 50, 100]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </el-card>
  </div>

  <el-dialog v-model="detailVisible" title="报警记录详情" width="560px">
    <el-descriptions v-if="selectedAlarm" :column="2" border>
      <el-descriptions-item label="设备号">{{ selectedAlarm.deviceId }}</el-descriptions-item>
      <el-descriptions-item label="监护对象ID">{{ selectedAlarm.targetId }}</el-descriptions-item>
      <el-descriptions-item label="告警类型">{{ alarmTypeLabelMap[selectedAlarm.alarmType] }}</el-descriptions-item>
      <el-descriptions-item label="告警级别">{{ alarmLevelText(selectedAlarm.alarmLevel as AlarmLevel) }}</el-descriptions-item>
      <el-descriptions-item label="处理状态">{{ alarmStatusText(selectedAlarm.handleStatus as AlarmHandleStatus) }}</el-descriptions-item>
      <el-descriptions-item label="告警时间">{{ dayjs(selectedAlarm.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}</el-descriptions-item>
      <el-descriptions-item label="所属区划">{{ `区域-${String(selectedAlarm.targetId).slice(-1)}` }}</el-descriptions-item>
      <el-descriptions-item label="处理人ID">{{ selectedAlarm.handlerId ?? '-' }}</el-descriptions-item>
      <el-descriptions-item label="处理时间">{{ selectedAlarm.handleTime ? dayjs(selectedAlarm.handleTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}</el-descriptions-item>
      <el-descriptions-item v-if="selectedAlarm.currentValue" label="触发值" :span="2">{{ selectedAlarm.currentValue }}</el-descriptions-item>
      <el-descriptions-item label="处理备注" :span="2">
        <el-input v-model="handleRemark" type="textarea" :rows="3" placeholder="填写处理备注" />
      </el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<style scoped>
.legend-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
</style>
