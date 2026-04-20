<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wardApi, serviceOrderApi } from '@/api/modules'
import { serviceStatusLabelMap, serviceTypeLabelMap } from '@/constants/dicts'
import { exportJsonToExcel } from '@/utils/export'
import { useAuthStore } from '@/stores/auth'
import type { NurseItem, ServiceOrder, ServiceOrderStatus, ServiceOrderType } from '@/types'

const auth = useAuthStore()
const chartRef = ref<HTMLElement>()
const durationChartRef = ref<HTMLElement>()
const loading = ref(false)
const list = ref<ServiceOrder[]>([])
const tab = ref<'ALL' | ServiceOrderStatus>('ALL')
const processVisible = ref(false)
const createVisible = ref(false)
const dispatchVisible = ref(false)
const currentOrder = ref<ServiceOrder | null>(null)
const guardianTargets = ref<{ memberId: number; name: string }[]>([])
const nurses = ref<NurseItem[]>([])

const processForm = reactive({ remark: '', newStatus: 'COMPLETED' as ServiceOrderStatus })
const createForm = reactive({
  orderType: 'MEDICINE_DELIVERY' as ServiceOrderType,
  targetId: null as number | null,
  appointmentTime: new Date(),
})
const dispatchForm = reactive({ nurseId: null as number | null })

const filtered = computed(() =>
  list.value.filter((item) => tab.value === 'ALL' || item.status === tab.value),
)

async function loadOrders() {
  loading.value = true
  try {
    const params: { orgId?: number } = {}
    if (auth.orgId) params.orgId = auth.orgId
    list.value = await serviceOrderApi.list(params)
  } finally {
    loading.value = false
    renderCharts()
  }
}

async function loadTargets() {
  guardianTargets.value = await wardApi.list().catch(() => [])
}

async function loadNurses() {
  if (!auth.orgId) return
  nurses.value = await serviceOrderApi.listNurses(auth.orgId).catch(() => [])
}

function renderCharts() {
  if (!chartRef.value || !durationChartRef.value) return
  const typeChart = echarts.init(chartRef.value)
  const typeMap = new Map<string, number>()
  filtered.value.forEach((item) => {
    const label = item.displayType || serviceTypeLabelMap[item.orderType as ServiceOrderType] || item.orderType
    typeMap.set(label, (typeMap.get(label) || 0) + 1)
  })
  typeChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: Array.from(typeMap.keys()) },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: Array.from(typeMap.values()), itemStyle: { color: '#10b981' } }],
  })
  const monthMap = new Map<string, number>()
  filtered.value.forEach((item) => {
    if (item.createdAt) {
      const m = dayjs(item.createdAt).format('MM月')
      monthMap.set(m, (monthMap.get(m) || 0) + 1)
    }
  })
  const months = Array.from(monthMap.keys()).slice(-6)
  const counts = months.map((m) => monthMap.get(m) || 0)
  const durationChart = echarts.init(durationChartRef.value)
  durationChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: months.length ? months : ['暂无数据'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: counts, smooth: true, itemStyle: { color: '#6366f1' } }],
  })
}

function openProcess(order: ServiceOrder) {
  currentOrder.value = order
  processForm.remark = ''
  processForm.newStatus = 'COMPLETED'
  processVisible.value = true
}

function openDispatch(order: ServiceOrder) {
  currentOrder.value = order
  dispatchForm.nurseId = order.nurseId ?? null
  dispatchVisible.value = true
}

async function completeOrder(order: ServiceOrder) {
  await serviceOrderApi.updateStatus(order.id, 'COMPLETED')
  order.status = 'COMPLETED'
  ElMessage.success('订单已完成')
  renderCharts()
}

async function cancelOrder(order: ServiceOrder) {
  await ElMessageBox.confirm('确认取消该订单？', '提示', { type: 'warning' })
  await serviceOrderApi.updateStatus(order.id, 'CANCELED')
  order.status = 'CANCELED'
  ElMessage.success('订单已取消')
  renderCharts()
}

async function submitProcess() {
  if (!currentOrder.value) return
  await serviceOrderApi.updateStatus(currentOrder.value.id, processForm.newStatus)
  currentOrder.value.status = processForm.newStatus
  processVisible.value = false
  ElMessage.success('处理状态已更新')
  renderCharts()
}

async function submitDispatch() {
  if (!currentOrder.value || !dispatchForm.nurseId) {
    ElMessage.warning('请选择医护人员')
    return
  }
  const nurse = nurses.value.find((n) => n.id === dispatchForm.nurseId)
  await serviceOrderApi.dispatch(currentOrder.value.id, dispatchForm.nurseId, nurse?.name ?? '')
  currentOrder.value.nurseId = dispatchForm.nurseId
  currentOrder.value.nurseName = nurse?.name
  dispatchVisible.value = false
  ElMessage.success('派单成功')
}

async function createOrder() {
  if (!createForm.targetId) {
    ElMessage.warning('请选择被监护人')
    return
  }
  await serviceOrderApi.create({
    orderType: createForm.orderType,
    targetId: createForm.targetId,
    appointmentTime: dayjs(createForm.appointmentTime).toISOString(),
  })
  createVisible.value = false
  ElMessage.success('预约创建成功')
  await loadOrders()
}

function exportExcel() {
  exportJsonToExcel(
    '服务预约列表',
    filtered.value.map((item) => ({
      订单ID: item.id,
      预约类型: item.displayType || serviceTypeLabelMap[item.orderType as ServiceOrderType] || item.orderType,
      预约时间: item.appointmentTime ? dayjs(item.appointmentTime).format('YYYY-MM-DD HH:mm') : '-',
      预约状态: serviceStatusLabelMap[item.status as ServiceOrderStatus] || item.status,
      联系人: item.contactName || '-',
      联系电话: item.contactPhone || '-',
      服务地址: item.serviceAddress || '-',
      药品清单: item.medicineList || '-',
      负责医护: item.nurseName || '-',
      补充说明: item.requirement || '-',
    })),
  )
}

onMounted(() => {
  loadOrders()
  loadTargets()
  loadNurses()
})
</script>

<template>
  <el-card class="page-card">
    <div class="page-toolbar">
      <el-button type="primary" @click="createVisible = true">新增预约</el-button>
      <el-radio-group v-model="tab" @change="renderCharts">
        <el-radio-button value="ALL">全部</el-radio-button>
        <el-radio-button value="PENDING">待处理</el-radio-button>
        <el-radio-button value="ACCEPTED">已派单</el-radio-button>
        <el-radio-button value="COMPLETED">已完成</el-radio-button>
        <el-radio-button value="CANCELED">已取消</el-radio-button>
      </el-radio-group>
      <el-button @click="exportExcel">导出Excel</el-button>
    </div>
    <el-table v-loading="loading" :data="filtered" border height="500">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="预约类型" min-width="100">
        <template #default="{ row }">
          {{ row.displayType || serviceTypeLabelMap[row.orderType as ServiceOrderType] || row.orderType || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="预约时间" min-width="150">
        <template #default="{ row }">{{ row.appointmentTime ? dayjs(row.appointmentTime).format('YYYY-MM-DD HH:mm') : '-' }}</template>
      </el-table-column>
      <el-table-column label="联系人" min-width="90">
        <template #default="{ row }">{{ row.contactName || '-' }}</template>
      </el-table-column>
      <el-table-column label="联系电话" min-width="120">
        <template #default="{ row }">{{ row.contactPhone || '-' }}</template>
      </el-table-column>
      <el-table-column label="服务地址" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.serviceAddress || '-' }}</template>
      </el-table-column>
      <el-table-column label="药品清单" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.medicineList || '-' }}</template>
      </el-table-column>
      <el-table-column label="补充说明" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.requirement || '-' }}</template>
      </el-table-column>
      <el-table-column label="预约状态" min-width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'COMPLETED' ? 'success' : row.status === 'CANCELED' ? 'info' : row.status === 'ACCEPTED' ? '' : 'warning'">
            {{ serviceStatusLabelMap[row.status as ServiceOrderStatus] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="负责医护" min-width="100">
        <template #default="{ row }">{{ row.nurseName || '-' }}</template>
      </el-table-column>
      <el-table-column label="派单方" min-width="90">
        <template #default="{ row }">{{ row.dispatchedBy || '-' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="150">
        <template #default="{ row }">{{ row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-space v-if="row.status === 'PENDING'">
            <el-button link type="primary" @click="openDispatch(row)">派单</el-button>
            <el-button link @click="openProcess(row)">处理</el-button>
            <el-button link type="success" @click="completeOrder(row)">完成</el-button>
            <el-button link type="danger" @click="cancelOrder(row)">取消</el-button>
          </el-space>
          <span v-else style="color:#909399;font-size:13px">{{ serviceStatusLabelMap[row.status as ServiceOrderStatus] || row.status }}</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <div class="grid-2" style="margin-top: 16px">
    <el-card class="page-card">
      <template #header>月度预约类型统计</template>
      <div ref="chartRef" class="chart" />
    </el-card>
    <el-card class="page-card">
      <template #header>近期预约数量趋势</template>
      <div ref="durationChartRef" class="chart" />
    </el-card>
  </div>

  <!-- 派单弹窗 -->
  <el-dialog v-model="dispatchVisible" title="派单" width="400px">
    <el-form label-width="90px">
      <el-form-item label="选择医护">
        <el-select v-model="dispatchForm.nurseId" placeholder="请选择医护人员" style="width:100%">
          <el-option v-for="n in nurses" :key="n.id" :label="`${n.name}${n.phone ? '  ' + n.phone : ''}`" :value="n.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dispatchVisible = false">取消</el-button>
      <el-button type="primary" @click="submitDispatch">确认派单</el-button>
    </template>
  </el-dialog>

  <!-- 处理弹窗 -->
  <el-dialog v-model="processVisible" title="处理预约" width="440px">
    <el-form :model="processForm" label-width="110px">
      <el-form-item label="更新状态">
        <el-select v-model="processForm.newStatus" style="width:100%">
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
      </el-form-item>
      <el-form-item label="处理备注">
        <el-input v-model="processForm.remark" type="textarea" placeholder="选填" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="processVisible = false">取消</el-button>
      <el-button type="primary" @click="submitProcess">提交</el-button>
    </template>
  </el-dialog>

  <!-- 新增弹窗 -->
  <el-dialog v-model="createVisible" title="新增预约" width="500px">
    <el-form :model="createForm" label-width="110px">
      <el-form-item label="预约类型">
        <el-select v-model="createForm.orderType" style="width: 100%">
          <el-option label="送药" value="MEDICINE_DELIVERY" />
          <el-option label="家访" value="HOME_VISIT" />
          <el-option label="体检" value="PHYSICAL_EXAM" />
        </el-select>
      </el-form-item>
      <el-form-item label="被监护人" required>
        <el-select v-model="createForm.targetId" placeholder="请选择" style="width: 100%">
          <el-option v-for="t in guardianTargets" :key="t.memberId" :label="t.name" :value="t.memberId" />
        </el-select>
      </el-form-item>
      <el-form-item label="预约时间">
        <el-date-picker v-model="createForm.appointmentTime" type="datetime" style="width:100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" @click="createOrder">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.chart { height: 320px; }
</style>
