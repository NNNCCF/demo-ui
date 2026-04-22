<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { serviceOrderApi, wardApi } from '@/api/modules'
import { serviceStatusLabelMap, serviceTypeLabelMap } from '@/constants/dicts'
import { useAuthStore } from '@/stores/auth'
import { exportJsonToExcel } from '@/utils/export'
import type { NurseItem, ServiceOrder, ServiceOrderStatus, ServiceOrderType } from '@/types'

const auth = useAuthStore()
const isAdmin = computed(() => auth.userInfo?.role === 'ADMIN')

const loading = ref(false)
const list = ref<ServiceOrder[]>([])
const targets = ref<{ memberId: number; name: string }[]>([])
const nurses = ref<NurseItem[]>([])

const detailVisible = ref(false)
const formVisible = ref(false)
const dispatchVisible = ref(false)
const currentOrder = ref<ServiceOrder | null>(null)
const formMode = ref<'create' | 'edit'>('create')

const typeChartRef = ref<HTMLElement>()
const trendChartRef = ref<HTMLElement>()
let typeChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null

const filters = reactive({
  keyword: '',
  orderType: '' as '' | ServiceOrderType,
  status: 'ALL' as 'ALL' | ServiceOrderStatus,
})

const form = reactive({
  id: null as number | null,
  orderType: 'MEDICINE_DELIVERY' as ServiceOrderType,
  targetId: null as number | null,
  appointmentTime: '',
  status: 'PENDING' as ServiceOrderStatus,
  displayType: '',
  contactName: '',
  contactPhone: '',
  serviceAddress: '',
  medicineList: '',
  requirement: '',
  nurseId: null as number | null,
  nurseName: '',
  payAmount: '',
  payStatus: '',
  visitTime: '',
  visitRemark: '',
})

const dispatchForm = reactive({
  nurseId: null as number | null,
})

const summary = computed(() => ({
  total: list.value.length,
  pending: list.value.filter((item) => item.status === 'PENDING').length,
  accepted: list.value.filter((item) => item.status === 'ACCEPTED').length,
  completed: list.value.filter((item) => item.status === 'COMPLETED').length,
}))

function normalizeDateTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : ''
}

function resetForm() {
  form.id = null
  form.orderType = 'MEDICINE_DELIVERY'
  form.targetId = null
  form.appointmentTime = ''
  form.status = 'PENDING'
  form.displayType = ''
  form.contactName = ''
  form.contactPhone = ''
  form.serviceAddress = ''
  form.medicineList = ''
  form.requirement = ''
  form.nurseId = null
  form.nurseName = ''
  form.payAmount = ''
  form.payStatus = ''
  form.visitTime = ''
  form.visitRemark = ''
}

function fillForm(row: ServiceOrder) {
  form.id = row.id
  form.orderType = row.orderType
  form.targetId = row.targetId
  form.appointmentTime = normalizeDateTime(row.appointmentTime)
  form.status = row.status
  form.displayType = row.displayType || ''
  form.contactName = row.contactName || ''
  form.contactPhone = row.contactPhone || ''
  form.serviceAddress = row.serviceAddress || ''
  form.medicineList = row.medicineList || ''
  form.requirement = row.requirement || ''
  form.nurseId = row.nurseId ?? null
  form.nurseName = row.nurseName || ''
  form.payAmount = row.payAmount || ''
  form.payStatus = row.payStatus || ''
  form.visitTime = normalizeDateTime(row.visitTime)
  form.visitRemark = row.visitRemark || ''
}

function toIsoOrUndefined(value: string) {
  return value ? dayjs(value).toISOString() : undefined
}

function buildPayload() {
  if (!form.targetId) {
    throw new Error('请选择预约对象')
  }
  if (!form.appointmentTime) {
    throw new Error('请选择预约时间')
  }
  const selectedNurse = nurses.value.find((item) => item.id === form.nurseId)
  return {
    orderType: form.orderType,
    targetId: form.targetId,
    appointmentTime: dayjs(form.appointmentTime).toISOString(),
    status: form.status,
    orgId: auth.userInfo?.orgId ?? undefined,
    nurseId: form.nurseId || undefined,
    nurseName: selectedNurse?.name || form.nurseName || undefined,
    displayType: form.displayType || undefined,
    contactName: form.contactName || undefined,
    contactPhone: form.contactPhone || undefined,
    serviceAddress: form.serviceAddress || undefined,
    medicineList: form.medicineList || undefined,
    requirement: form.requirement || undefined,
    visitTime: toIsoOrUndefined(form.visitTime),
    payAmount: form.payAmount || undefined,
    payStatus: form.payStatus || undefined,
    visitRemark: form.visitRemark || undefined,
  }
}

function orderTypeLabel(order: ServiceOrder) {
  return order.displayType || serviceTypeLabelMap[order.orderType] || order.orderType
}

function statusLabel(status: ServiceOrderStatus) {
  return serviceStatusLabelMap[status] || status
}

async function loadOrders() {
  loading.value = true
  try {
    list.value = await serviceOrderApi.list({
      orgId: auth.userInfo?.orgId || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      orderType: filters.orderType || undefined,
      keyword: filters.keyword.trim() || undefined,
    })
  } finally {
    loading.value = false
    await nextTick()
    renderCharts()
  }
}

async function loadTargets() {
  targets.value = await wardApi.list().catch(() => [])
}

async function loadNurses() {
  nurses.value = await serviceOrderApi.listNurses(auth.userInfo?.orgId ?? undefined).catch(() => [])
}

function renderCharts() {
  if (!typeChartRef.value || !trendChartRef.value) {
    return
  }

  if (!typeChart) {
    typeChart = echarts.init(typeChartRef.value)
  }
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const typeMap = new Map<string, number>()
  list.value.forEach((item) => {
    const label = item.displayType || serviceTypeLabelMap[item.orderType] || item.orderType
    typeMap.set(label, (typeMap.get(label) || 0) + 1)
  })

  typeChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: Array.from(typeMap.keys()) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: Array.from(typeMap.values()),
        itemStyle: { color: '#3b82f6' },
        barMaxWidth: 48,
      },
    ],
  })

  const trendMap = new Map<string, number>()
  list.value.forEach((item) => {
    const key = item.createdAt ? dayjs(item.createdAt).format('MM-DD') : '未知'
    trendMap.set(key, (trendMap.get(key) || 0) + 1)
  })

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: Array.from(trendMap.keys()) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'line',
        smooth: true,
        data: Array.from(trendMap.values()),
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16,185,129,0.18)' },
      },
    ],
  })
}

function openCreate() {
  resetForm()
  formMode.value = 'create'
  formVisible.value = true
}

function openEdit(row: ServiceOrder) {
  fillForm(row)
  formMode.value = 'edit'
  formVisible.value = true
}

async function openDetail(row: ServiceOrder) {
  currentOrder.value = await serviceOrderApi.detail(row.id).catch(() => row)
  detailVisible.value = true
}

function openDispatch(row: ServiceOrder) {
  currentOrder.value = row
  dispatchForm.nurseId = row.nurseId ?? null
  dispatchVisible.value = true
}

async function submitForm() {
  try {
    const payload = buildPayload()
    if (formMode.value === 'create') {
      await serviceOrderApi.create(payload)
      ElMessage.success('预约订单创建成功')
    } else if (form.id) {
      await serviceOrderApi.update(form.id, payload)
      ElMessage.success('预约订单更新成功')
    }
    formVisible.value = false
    await loadOrders()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

async function submitDispatch() {
  if (!currentOrder.value || !dispatchForm.nurseId) {
    ElMessage.warning('请选择护理人员')
    return
  }
  const nurse = nurses.value.find((item) => item.id === dispatchForm.nurseId)
  await serviceOrderApi.dispatch(currentOrder.value.id, dispatchForm.nurseId, nurse?.name ?? '')
  ElMessage.success('派单成功')
  dispatchVisible.value = false
  await loadOrders()
}

async function updateStatus(row: ServiceOrder, status: ServiceOrderStatus) {
  const actionMap: Record<ServiceOrderStatus, string> = {
    PENDING: '恢复待处理',
    ACCEPTED: '标记已接单',
    COMPLETED: '标记已完成',
    CANCELED: '取消订单',
  }
  await ElMessageBox.confirm(`确认${actionMap[status]}吗？`, '提示', { type: 'warning' })
  await serviceOrderApi.updateStatus(row.id, status)
  ElMessage.success('订单状态已更新')
  await loadOrders()
}

async function removeOrder(row: ServiceOrder) {
  await ElMessageBox.confirm(`确认删除订单 #${row.id} 吗？`, '提示', { type: 'warning' })
  await serviceOrderApi.delete(row.id)
  ElMessage.success('订单已删除')
  await loadOrders()
}

function exportExcel() {
  exportJsonToExcel(
    '预约订单',
    list.value.map((item) => ({
      订单ID: item.id,
      预约类型: item.displayType || serviceTypeLabelMap[item.orderType] || item.orderType,
      预约状态: serviceStatusLabelMap[item.status] || item.status,
      预约对象ID: item.targetId,
      联系人: item.contactName || '-',
      联系电话: item.contactPhone || '-',
      服务地址: item.serviceAddress || '-',
      预约时间: item.appointmentTime ? dayjs(item.appointmentTime).format('YYYY-MM-DD HH:mm') : '-',
      护理人员: item.nurseName || '-',
      创建时间: item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-',
    })),
  )
}

onMounted(async () => {
  await Promise.all([loadOrders(), loadTargets(), loadNurses()])
})
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">预约订单管理</span>
      <div class="header-actions">
        <el-button @click="loadOrders">刷新</el-button>
        <el-button @click="exportExcel">导出</el-button>
        <el-button v-if="isAdmin" type="primary" @click="openCreate">新建订单</el-button>
      </div>
    </div>

    <div class="stats-grid">
      <el-card class="page-card stat-card">
        <div class="stat-label">订单总数</div>
        <div class="stat-value">{{ summary.total }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">待处理</div>
        <div class="stat-value warning">{{ summary.pending }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">已接单</div>
        <div class="stat-value primary">{{ summary.accepted }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">已完成</div>
        <div class="stat-value success">{{ summary.completed }}</div>
      </el-card>
    </div>

    <el-card class="page-card" style="margin-top: 16px;">
      <div class="page-toolbar">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索订单编号、联系人、地址、护理人员"
          clearable
          style="width: 280px;"
          @keyup.enter="loadOrders"
        />
        <el-select v-model="filters.orderType" placeholder="预约类型" clearable style="width: 180px;">
          <el-option label="送药上门" value="MEDICINE_DELIVERY" />
          <el-option label="上门访视" value="HOME_VISIT" />
          <el-option label="体检预约" value="PHYSICAL_EXAM" />
        </el-select>
        <el-select v-model="filters.status" placeholder="订单状态" style="width: 180px;">
          <el-option label="全部状态" value="ALL" />
          <el-option label="待处理" value="PENDING" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
        <el-button type="primary" @click="loadOrders">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="id" label="订单ID" width="90" />
        <el-table-column label="预约类型" min-width="120">
          <template #default="{ row }">
            {{ orderTypeLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="预约时间" min-width="170">
          <template #default="{ row }">
            {{ row.appointmentTime ? dayjs(row.appointmentTime).format('YYYY-MM-DD HH:mm') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="联系人" min-width="110">
          <template #default="{ row }">{{ row.contactName || '-' }}</template>
        </el-table-column>
        <el-table-column label="联系电话" min-width="140">
          <template #default="{ row }">{{ row.contactPhone || '-' }}</template>
        </el-table-column>
        <el-table-column label="服务地址" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.serviceAddress || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'COMPLETED' ? 'success' : row.status === 'CANCELED' ? 'info' : row.status === 'ACCEPTED' ? 'primary' : 'warning'">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="护理人员" min-width="120">
          <template #default="{ row }">{{ row.nurseName || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">
            {{ row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <template v-if="isAdmin">
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link @click="openDispatch(row)">派单</el-button>
                <el-button v-if="row.status !== 'COMPLETED'" link type="success" @click="updateStatus(row, 'COMPLETED')">完成</el-button>
                <el-button v-if="row.status !== 'CANCELED'" link type="warning" @click="updateStatus(row, 'CANCELED')">取消</el-button>
                <el-button link type="danger" @click="removeOrder(row)">删除</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="grid-2" style="margin-top: 16px;">
      <el-card class="page-card">
        <template #header>预约类型分布</template>
        <div ref="typeChartRef" class="chart" />
      </el-card>
      <el-card class="page-card">
        <template #header>订单趋势</template>
        <div ref="trendChartRef" class="chart" />
      </el-card>
    </div>

    <el-drawer v-model="detailVisible" title="订单详情" size="560px">
      <template v-if="currentOrder">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="订单ID">{{ currentOrder.id }}</el-descriptions-item>
          <el-descriptions-item label="预约类型">
            {{ orderTypeLabel(currentOrder) }}
          </el-descriptions-item>
          <el-descriptions-item label="预约状态">
            {{ statusLabel(currentOrder.status) }}
          </el-descriptions-item>
          <el-descriptions-item label="预约对象ID">{{ currentOrder.targetId }}</el-descriptions-item>
          <el-descriptions-item label="预约时间">
            {{ currentOrder.appointmentTime ? dayjs(currentOrder.appointmentTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">{{ currentOrder.contactName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.contactPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务地址">{{ currentOrder.serviceAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="药品清单">{{ currentOrder.medicineList || '-' }}</el-descriptions-item>
          <el-descriptions-item label="护理人员">{{ currentOrder.nurseName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="支付状态">{{ currentOrder.payStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="支付金额">{{ currentOrder.payAmount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="补充说明">{{ currentOrder.requirement || '-' }}</el-descriptions-item>
          <el-descriptions-item label="回访记录">{{ currentOrder.visitRemark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>

    <el-dialog v-model="formVisible" :title="formMode === 'create' ? '新建预约订单' : '编辑预约订单'" width="760px">
      <el-form label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="预约类型" required>
              <el-select v-model="form.orderType" style="width: 100%">
                <el-option label="送药上门" value="MEDICINE_DELIVERY" />
                <el-option label="上门访视" value="HOME_VISIT" />
                <el-option label="体检预约" value="PHYSICAL_EXAM" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="展示名称">
              <el-input v-model="form.displayType" placeholder="可选，自定义展示名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预约对象" required>
              <el-select v-model="form.targetId" placeholder="请选择预约对象" filterable style="width: 100%">
                <el-option v-for="item in targets" :key="item.memberId" :label="item.name" :value="item.memberId" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预约时间" required>
              <el-date-picker
                v-model="form.appointmentTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="订单状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="待处理" value="PENDING" />
                <el-option label="已接单" value="ACCEPTED" />
                <el-option label="已完成" value="COMPLETED" />
                <el-option label="已取消" value="CANCELED" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="护理人员">
              <el-select v-model="form.nurseId" placeholder="可选" clearable filterable style="width: 100%">
                <el-option v-for="item in nurses" :key="item.id" :label="`${item.name}${item.phone ? ` (${item.phone})` : ''}`" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="服务地址">
              <el-input v-model="form.serviceAddress" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="药品清单">
              <el-input v-model="form.medicineList" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="补充说明">
              <el-input v-model="form.requirement" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="支付状态">
              <el-input v-model="form.payStatus" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="支付金额">
              <el-input v-model="form.payAmount" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="回访时间">
              <el-date-picker
                v-model="form.visitTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="回访记录">
              <el-input v-model="form.visitRemark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dispatchVisible" title="派单" width="420px">
      <el-form label-width="90px">
        <el-form-item label="护理人员" required>
          <el-select v-model="dispatchForm.nurseId" placeholder="请选择护理人员" style="width: 100%">
            <el-option v-for="item in nurses" :key="item.id" :label="`${item.name}${item.phone ? ` (${item.phone})` : ''}`" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dispatchVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDispatch">确认派单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 4px 6px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
}

.stat-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.primary {
  color: #3b82f6;
}

.stat-value.warning {
  color: #f59e0b;
}

.stat-value.success {
  color: #10b981;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.action-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chart {
  height: 320px;
}

@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
