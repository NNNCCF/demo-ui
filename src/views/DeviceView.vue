<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Link, CircleClose, Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { deviceApi, clientUserApi, wardApi, familyApi, organizationApi } from '@/api/modules'
import { deviceStatusLabelMap, deviceTypeLabelMap } from '@/constants/dicts'
import { exportJsonToExcel } from '@/utils/export'
import type { ClientUser, Device, DeviceProvisioningResult, DeviceStatus, DeviceType } from '@/types'

const router = useRouter()
const loading = ref(false)
const list = ref<Device[]>([])
const selection = ref<Device[]>([])
const currentPage = ref(1)
const pageSize = ref(10)

const guardians = ref<ClientUser[]>([])
const wards = ref<{ memberId: number; name: string }[]>([])
const guardianTargets = ref<{ id: number; name: string }[]>([])
const families = ref<{ id: number; name: string }[]>([])
const orgs = ref<{ id: number; name: string; type: string }[]>([])
const medicalOrgs = computed(() => orgs.value.filter(o => o.type === 'MEDICAL_INSTITUTION'))
const communityOrgs = computed(() => orgs.value.filter(o => o.type === 'COMMUNITY'))

const filters = reactive({
  region: '',
  status: '' as DeviceStatus | '',
  address: '',
  deviceId: '',
  wardName: '',
  guardianName: '',
  medicalInstitution: '',
  communityManagement: '',
})

const editVisible = ref(false)
const targetVisible = ref(false)
const newTarget = ref({ name: '', mobile: '' })

const unbindVisible = ref(false)
const credentialVisible = ref(false)
const provisioningResult = ref<DeviceProvisioningResult | null>(null)
const editing = ref({
  deviceId: '',
  deviceType: 'FALL_DETECTOR' as DeviceType,
  targetId: undefined as number | undefined,
  address: '',
  homeLocation: '',
  roomNumber: '',
  medicalInstitution: '',
  propertyManagement: '',
  guardianId: undefined as number | undefined,
  wardIds: [] as number[],
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  familyId: undefined as number | undefined,
})
const unbindDeviceId = ref('')
const allSelected = ref(false)

let polling = false
let pollTimer: ReturnType<typeof setInterval> | null = null

const filteredList = computed(() => {
  return list.value.filter((item) => {
    const matchRegion = !filters.region || (item.homeLocation || '').includes(filters.region)
    const matchStatus = !filters.status || item.status === filters.status
    const matchAddress = !filters.address || (item.address || '').includes(filters.address)
    const matchDeviceId = !filters.deviceId || item.deviceId.includes(filters.deviceId)
    const matchWard = !filters.wardName || (item.wards || []).some(w => w.name === filters.wardName)
    const matchGuardian = !filters.guardianName || (item.guardian?.name || '') === filters.guardianName
    const matchMedical = !filters.medicalInstitution || (item.medicalInstitution || '') === filters.medicalInstitution
    const matchCommunity = !filters.communityManagement || (item.propertyManagement || '') === filters.communityManagement

    return matchRegion && matchStatus && matchAddress && matchDeviceId && matchWard && matchGuardian && matchMedical && matchCommunity
  })
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

async function loadDevices() {
  loading.value = true
  try {
    list.value = await deviceApi.list()
    // Pre-fetch metadata for creation
    const [userList, wardList, familyList, orgList] = await Promise.all([
      clientUserApi.list(),
      wardApi.list(),
      familyApi.list(),
      organizationApi.list(),
    ])
    guardians.value = userList.filter(u => u.role === 'GUARDIAN')
    wards.value = wardList
    guardianTargets.value = wardList.map(w => ({ id: w.memberId, name: w.name }))
    families.value = familyList.map(f => ({ id: f.id, name: f.name }))
    orgs.value = orgList
  } finally {
    loading.value = false
  }
}

async function refreshDevicesSilently() {
  if (polling) {
    return
  }
  polling = true
  try {
    list.value = await deviceApi.list()
  } finally {
    polling = false
  }
}

function resetFilters() {
  Object.keys(filters).forEach(key => {
    (filters as any)[key] = ''
  })
}

function handleSelectionChange(rows: Device[]) {
  selection.value = rows
}

function openCreate() {
  currentDeviceId.value = null
  provisioningResult.value = null
  editing.value = {
    deviceId: '',
    deviceType: 'FALL_DETECTOR',
    targetId: undefined,
    address: '',
    homeLocation: '',
    roomNumber: '',
    medicalInstitution: '',
    propertyManagement: '',
    guardianId: undefined,
    wardIds: [],
    latitude: undefined,
    longitude: undefined,
    familyId: undefined
  }
  editVisible.value = true
}

const currentDeviceId = ref<string | null>(null)

function openEdit(device: Device) {
  currentDeviceId.value = device.deviceId
  editing.value = {
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    targetId: device.targetId ?? undefined,
    address: device.address || '',
    homeLocation: device.homeLocation || '',
    roomNumber: device.roomNumber || '',
    medicalInstitution: device.medicalInstitution || '',
    propertyManagement: device.propertyManagement || '',
    guardianId: device.guardian?.id,
    wardIds: (device.wards || []).map(w => w.memberId),
    latitude: device.latitude,
    longitude: device.longitude,
    familyId: device.familyId ?? undefined
  }
  editVisible.value = true
}

async function saveTarget() {
  if (!newTarget.value.name) {
    ElMessage.warning('请输入姓名')
    return
  }
  const created = await clientUserApi.create({
    name: newTarget.value.name,
    mobile: newTarget.value.mobile || undefined,
    role: 'WARD',
  })
  ElMessage.success('被监护人添加成功')
  // refresh ward list and update dropdown
  const wardList = await wardApi.list()
  wards.value = wardList
  guardianTargets.value = wardList.map(w => ({ id: w.memberId, name: w.name }))
  editing.value.targetId = created.id
  targetVisible.value = false
}

async function deleteOne(device: Device) {
  try {
    await ElMessageBox.confirm(`确认删除设备 ${device.deviceId} 吗？该操作不可恢复。`, '警告', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
    await deviceApi.delete(device.deviceId)
    ElMessage.success('设备已删除')
    await loadDevices()
  } catch {
    // Cancelled
  }
}

async function saveDevice() {
  if (currentDeviceId.value) {
    const { deviceId, ...payload } = editing.value
    await deviceApi.update(currentDeviceId.value, payload)
    ElMessage.success('设备更新成功')
  } else {
    provisioningResult.value = await deviceApi.register(editing.value)
    credentialVisible.value = true
    ElMessage.success('新增设备成功')
  }
  editVisible.value = false
  await loadDevices()
}

async function disableBatch() {
  if (!selection.value.length) {
    ElMessage.warning('请先选择设备')
    return
  }
  await Promise.all(selection.value.map((device) => deviceApi.disable(device.deviceId)))
  ElMessage.success('批量禁用已完成')
  await loadDevices()
}

async function batchUnbind() {
  if (!selection.value.length) {
    ElMessage.warning('请先选择设备')
    return
  }
  await Promise.all(selection.value.map((device) => deviceApi.unbind(device.deviceId)))
  ElMessage.success('批量解绑已完成')
  await loadDevices()
}

function openUnbind(deviceId: string) {
  unbindDeviceId.value = deviceId
  unbindVisible.value = true
}

async function confirmUnbind() {
  await deviceApi.unbind(unbindDeviceId.value)
  unbindVisible.value = false
  ElMessage.success('解绑成功')
  await loadDevices()
}

async function rotateCredentials(device: Device) {
  try {
    await ElMessageBox.confirm(
      `确认轮换设备 ${device.deviceId} 的 MQTT 凭证吗？轮换后旧密码会立即失效。`,
      '轮换凭证',
      {
        type: 'warning',
        confirmButtonText: '确认轮换',
        cancelButtonText: '取消',
      },
    )
    provisioningResult.value = await deviceApi.rotateCredentials(device.deviceId)
    credentialVisible.value = true
    ElMessage.success('MQTT 凭证已轮换')
  } catch {
    // Cancelled
  }
}

async function toggleDeviceStatus(device: Device) {
  if (device.status === 'DISABLED') {
    await deviceApi.enable(device.deviceId)
    ElMessage.success('设备已启用')
  } else {
    await ElMessageBox.confirm(`确认禁用设备 ${device.deviceId} 吗？`, '提示')
    await deviceApi.disable(device.deviceId)
    ElMessage.success('设备已禁用')
  }
  await loadDevices()
}

function exportExcel() {
  exportJsonToExcel(
    '设备管理列表',
    filteredList.value.map((item) => ({
      设备号: item.deviceId,
      类型: deviceTypeLabelMap[item.deviceType],
      状态: deviceStatusLabelMap[item.status],
      被监护人ID: item.targetId || '-',
      创建时间: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    })),
  )
}

function deviceStatusText(value: DeviceStatus) {
  return deviceStatusLabelMap[value]
}

async function copyCredential(label: string, value?: string) {
  if (!value) {
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.warning(`复制${label}失败，请手动复制`)
  }
}

function startDevicePolling() {
  pollTimer = setInterval(refreshDevicesSilently, 30000)
}
function stopDevicePolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  await loadDevices()
  startDevicePolling()
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopDevicePolling() : (startDevicePolling(), refreshDevicesSilently())
  })
  window.addEventListener('blur', stopDevicePolling)
  window.addEventListener('focus', startDevicePolling)
})

onUnmounted(() => {
  stopDevicePolling()
  document.removeEventListener('visibilitychange', stopDevicePolling)
  window.removeEventListener('blur', stopDevicePolling)
  window.removeEventListener('focus', startDevicePolling)
})
</script>

<template>
  <div class="page-wrap">
  <div class="page-header">
    <span class="page-title">设备管理</span>
  </div>
  <el-card class="page-card">
    <!-- Filter Toolbar -->
    <div class="filter-toolbar">
      <el-select v-model="filters.region" placeholder="所属区划" style="width: 140px" clearable>
        <el-option label="万柏林区" value="万柏林区" />
        <el-option label="迎泽区" value="迎泽区" />
      </el-select>
      
      <el-select v-model="filters.status" placeholder="设备状态" style="width: 120px" clearable>
        <el-option label="正常" value="ONLINE" />
        <el-option label="禁用" value="DISABLED" />
        <el-option label="离线" value="OFFLINE" />
      </el-select>
      
      <el-input v-model="filters.address" placeholder="设备位置详情..." style="width: 160px" clearable />
      <el-input v-model="filters.deviceId" placeholder="设备号..." style="width: 140px" clearable />

      <el-select v-model="filters.wardName" placeholder="被监护人" style="width: 130px" clearable filterable>
        <el-option v-for="w in wards" :key="w.memberId" :label="w.name" :value="w.name" />
      </el-select>

      <el-select v-model="filters.guardianName" placeholder="监护人" style="width: 130px" clearable filterable>
        <el-option v-for="g in guardians" :key="g.id" :label="g.name" :value="g.name" />
      </el-select>

      <el-select v-model="filters.medicalInstitution" placeholder="所属医疗机构" style="width: 160px" clearable filterable>
        <el-option v-for="o in medicalOrgs" :key="o.id" :label="o.name" :value="o.name" />
      </el-select>

      <el-select v-model="filters.communityManagement" placeholder="所属社区" style="width: 140px" clearable filterable>
        <el-option v-for="o in communityOrgs" :key="o.id" :label="o.name" :value="o.name" />
      </el-select>
      
      <div class="filter-actions">
        <el-button @click="resetFilters">重置</el-button>
        <el-button type="primary" @click="loadDevices">查询</el-button>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div class="action-toolbar">
      <div class="left-actions">
        <el-checkbox v-model="allSelected" disabled label="全选" style="margin-right: 16px" />
        <el-button type="primary" link @click="openCreate">
          <el-icon><Plus /></el-icon> 新增设备
        </el-button>
        <el-button type="primary" link @click="batchUnbind">
          <el-icon><Link /></el-icon> 批量解绑
        </el-button>
        <el-button type="primary" link @click="disableBatch">
          <el-icon><CircleClose /></el-icon> 批量禁用
        </el-button>
        <el-button type="primary" link @click="exportExcel">
          <el-icon><Download /></el-icon> 导出Excel
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="pagedList"
      class="device-table"
      header-cell-class-name="table-header"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column type="index" label="序号" width="60" />
      
      <el-table-column label="设备号" min-width="120">
        <template #default="{ row }">
          <el-link type="primary" @click="router.push(`/devices/${row.deviceId}`)">{{ row.deviceId }}</el-link>
        </template>
      </el-table-column>
      
      <el-table-column prop="address" label="设备位置" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.homeLocation }}{{ row.address }}{{ row.roomNumber }}
        </template>
      </el-table-column>
      
      <el-table-column label="设备状态" width="100">
        <template #default="{ row }">
          <div class="status-cell">
            <span class="status-dot" :class="row.status.toLowerCase()"></span>
            <span>{{ deviceStatusText(row.status) }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="监护人" min-width="140">
        <template #default="{ row }">
          <div v-if="row.guardian">
            {{ row.guardian.name }} {{ row.guardian.mobile }}
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column label="被监护人" min-width="140">
        <template #default="{ row }">
          <span v-if="row.wards && row.wards.length">
            {{ row.wards.map((w: any) => w.name).join('、') }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      
      <el-table-column prop="medicalInstitution" label="所属医疗机构" min-width="160" show-overflow-tooltip />
      <el-table-column prop="propertyManagement" label="所属物业" min-width="160" show-overflow-tooltip />
      
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="success" size="small" @click="rotateCredentials(row)">凭证</el-button>
          <el-button link type="warning" size="small" @click="openUnbind(row.deviceId)">解绑</el-button>
          <el-button 
            link 
            :type="row.status === 'DISABLED' ? 'success' : 'warning'" 
            size="small"
            @click="toggleDeviceStatus(row)"
          >
            {{ row.status === 'DISABLED' ? '使用' : '禁用' }}
          </el-button>
          <el-button link type="danger" size="small" @click="deleteOne(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <span class="total-text">共 {{ filteredList.length }} 条</span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="prev, pager, next, sizes"
        :total="filteredList.length"
      />
    </div>

    <el-dialog
      v-model="unbindVisible"
      title="设备解绑"
      width="420px"
    >
      <span>确认解绑设备 {{ unbindDeviceId }} 吗？</span>
      <template #footer>
        <el-button @click="unbindVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUnbind">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="credentialVisible"
      title="MQTT 凭证"
      width="520px"
    >
      <div v-if="provisioningResult" class="credential-panel">
        <div class="credential-tip">
          密码只展示这一次，请及时保存到设备初始化流程或发放记录中。
        </div>
        <el-form label-width="110px">
          <el-form-item label="设备编号">
            <el-input :model-value="provisioningResult.deviceId" readonly />
          </el-form-item>
          <el-form-item label="MQTT 用户名">
            <div class="credential-row">
              <el-input :model-value="provisioningResult.mqttUsername" readonly />
              <el-button @click="copyCredential('用户名', provisioningResult.mqttUsername)">复制</el-button>
            </div>
          </el-form-item>
          <el-form-item label="MQTT 密码">
            <div class="credential-row">
              <el-input :model-value="provisioningResult.mqttPassword" readonly show-password />
              <el-button type="primary" plain @click="copyCredential('密码', provisioningResult.mqttPassword)">复制</el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button type="primary" @click="credentialVisible = false">我已保存</el-button>
      </template>
    </el-dialog>
  </el-card>

  <!-- Create/Edit Dialog -->
  <el-dialog v-model="editVisible" :title="editing.deviceId ? '编辑设备' : '新增设备'" width="600px">
    <el-form :model="editing" label-width="110px">
      <el-form-item label="设备号">
        <el-input v-model="editing.deviceId" placeholder="请输入设备号" :disabled="!!currentDeviceId" />
      </el-form-item>
      
      <el-form-item label="设备类型">
        <el-select v-model="editing.deviceType" style="width: 100%">
          <el-option label="跌倒检测器" value="FALL_DETECTOR" />
        </el-select>
      </el-form-item>

      <el-form-item label="设备位置">
        <el-input v-model="editing.homeLocation" placeholder="所属区划 (如: 迎泽区)" style="margin-bottom: 8px" />
        <el-input v-model="editing.address" placeholder="详细地址 (如: 长风小区1号楼)" style="margin-bottom: 8px" />
        <el-input v-model="editing.roomNumber" placeholder="房间(如：卧室、客厅、厨房……)" style="margin-bottom: 8px" />
        <el-row :gutter="10">
          <el-col :span="11">
            <el-input-number v-model="editing.longitude" placeholder="经度" :precision="6" :step="0.0001" style="width: 100%" :controls="false" />
          </el-col>
          <el-col :span="2" style="text-align: center">-</el-col>
          <el-col :span="11">
            <el-input-number v-model="editing.latitude" placeholder="纬度" :precision="6" :step="0.0001" style="width: 100%" :controls="false" />
          </el-col>
        </el-row>
      </el-form-item>

      <el-form-item label="监护人">
        <el-select v-model="editing.guardianId" placeholder="请选择监护人" style="width: 100%" filterable clearable>
          <el-option
            v-for="item in guardians"
            :key="item.id"
            :label="`${item.name} (${item.mobile || '-'})`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="被监护人">
        <el-select v-model="editing.wardIds" placeholder="请选择被监护人" style="width: 100%" multiple filterable>
          <el-option
            v-for="item in wards"
            :key="item.memberId"
            :label="item.name"
            :value="item.memberId"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="主被监护人" required>
        <el-row :gutter="10" style="width: 100%">
          <el-col :span="18">
            <el-select v-model="editing.targetId" placeholder="请选择主被监护人(用于鉴权)" style="width: 100%" filterable>
              <el-option
                v-for="item in guardianTargets"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-button @click="targetVisible = true; newTarget = { name: '', mobile: '' }">
              <el-icon><Plus /></el-icon> 新增
            </el-button>
          </el-col>
        </el-row>
      </el-form-item>

      <el-form-item label="所属家庭">
        <el-select v-model="editing.familyId" placeholder="请选择家庭（可选）" style="width: 100%" filterable clearable>
          <el-option v-for="f in families" :key="f.id" :label="f.name" :value="f.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="所属医疗机构">
        <el-select v-model="editing.medicalInstitution" placeholder="请选择医疗机构" style="width: 100%" filterable clearable>
          <el-option v-for="o in medicalOrgs" :key="o.id" :label="o.name" :value="o.name" />
        </el-select>
      </el-form-item>

      <el-form-item label="所属社区">
        <el-select v-model="editing.propertyManagement" placeholder="请选择社区" style="width: 100%" filterable clearable>
          <el-option v-for="o in communityOrgs" :key="o.id" :label="o.name" :value="o.name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" @click="saveDevice">保存</el-button>
    </template>
  </el-dialog>

  <!-- Add Target Dialog -->
  <el-dialog v-model="targetVisible" title="新增被监护人" width="420px">
    <el-form :model="newTarget" label-width="80px">
      <el-form-item label="姓名" required>
        <el-input v-model="newTarget.name" placeholder="请输入姓名" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="newTarget.mobile" placeholder="请输入手机号（可选）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="targetVisible = false">取消</el-button>
      <el-button type="primary" @click="saveTarget">确定</el-button>
    </template>
  </el-dialog>
  </div>
</template>

<style scoped>
.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-actions {
  margin-left: auto;
  display: flex;
  gap: 12px;
}

.action-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.online  { background-color: #22c55e; }
.status-dot.offline { background-color: #f59e0b; }
.status-dot.disabled { background-color: #94a3b8; }

.pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.credential-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.credential-tip {
  padding: 12px 14px;
  border-radius: 10px;
  background: #f5f7fa;
  color: #606266;
  line-height: 1.6;
}

.credential-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
}

.total-text {
  color: #606266;
  font-size: 14px;
}
</style>
