<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { paymentApi, serviceOrderApi, wardApi } from '@/api/modules'
import { serviceStatusLabelMap, serviceTypeLabelMap } from '@/constants/dicts'
import { useAuthStore } from '@/stores/auth'
import { exportJsonToExcel } from '@/utils/export'
import type { NurseItem, ServiceOrder, ServiceOrderStatus, ServiceOrderType } from '@/types'

const auth = useAuthStore()
const canWriteOrders = computed(() => auth.userInfo?.role === 'ADMIN')

const loading = ref(false)
const list = ref<ServiceOrder[]>([])
const totalOrders = ref(0)
const targets = ref<{ memberId: number; name: string }[]>([])
const nurses = ref<NurseItem[]>([])
const detailVisible = ref(false)
const formVisible = ref(false)
const dispatchVisible = ref(false)
const currentOrder = ref<ServiceOrder | null>(null)
const formMode = ref<'create' | 'edit'>('create')

const filters = reactive({
  keyword: '',
  orderType: '' as '' | ServiceOrderType,
  status: 'ALL' as 'ALL' | ServiceOrderStatus,
})

const pagination = reactive({
  page: 1,
  size: 10,
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
  payAmount: '',
  payStatus: '',
  visitRemark: '',
})

const dispatchForm = reactive({
  nurseId: null as number | null,
})

const summary = computed(() => ({
  total: totalOrders.value,
  pending: list.value.filter((item) => item.status === 'PENDING').length,
  accepted: list.value.filter((item) => item.status === 'ACCEPTED').length,
  completed: list.value.filter((item) => item.status === 'COMPLETED').length,
}))

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
  form.payAmount = ''
  form.payStatus = ''
  form.visitRemark = ''
}

function fillForm(row: ServiceOrder) {
  form.id = row.id
  form.orderType = row.orderType
  form.targetId = row.targetId
  form.appointmentTime = row.appointmentTime ? dayjs(row.appointmentTime).format('YYYY-MM-DD HH:mm:ss') : ''
  form.status = row.status
  form.displayType = row.displayType || ''
  form.contactName = row.contactName || ''
  form.contactPhone = row.contactPhone || ''
  form.serviceAddress = row.serviceAddress || ''
  form.medicineList = row.medicineList || ''
  form.requirement = row.requirement || ''
  form.nurseId = row.nurseId ?? null
  form.payAmount = row.payAmount || ''
  form.payStatus = row.payStatus || ''
  form.visitRemark = row.visitRemark || ''
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
    const pageData = await serviceOrderApi.list({
      orgId: auth.userInfo?.orgId || undefined,
      status: filters.status === 'ALL' ? undefined : filters.status,
      orderType: filters.orderType || undefined,
      keyword: filters.keyword.trim() || undefined,
      page: pagination.page - 1,
      size: pagination.size,
    })
    list.value = pageData.content
    totalOrders.value = pageData.totalElements
  } finally {
    loading.value = false
  }
}

async function resetAndLoadOrders() {
  pagination.page = 1
  await loadOrders()
}

async function loadTargets() {
  targets.value = await wardApi.list().catch(() => [])
}

async function loadNurses() {
  nurses.value = await serviceOrderApi.listNurses(auth.userInfo?.orgId ?? undefined).catch(() => [])
}

function buildPayload() {
  if (!form.targetId) throw new Error('请选择预约对象')
  if (!form.appointmentTime) throw new Error('请选择预约时间')
  const selectedNurse = nurses.value.find((item) => item.id === form.nurseId)
  return {
    orderType: form.orderType,
    targetId: form.targetId,
    appointmentTime: dayjs(form.appointmentTime).toISOString(),
    status: form.status,
    orgId: auth.userInfo?.orgId ?? undefined,
    nurseId: form.nurseId || undefined,
    nurseName: selectedNurse?.name || undefined,
    displayType: form.displayType || undefined,
    contactName: form.contactName || undefined,
    contactPhone: form.contactPhone || undefined,
    serviceAddress: form.serviceAddress || undefined,
    medicineList: form.medicineList || undefined,
    requirement: form.requirement || undefined,
    payAmount: form.payAmount || undefined,
    payStatus: form.payStatus || undefined,
    visitRemark: form.visitRemark || undefined,
  }
}

function openCreate() {
  if (!canWriteOrders.value) return
  resetForm()
  formMode.value = 'create'
  formVisible.value = true
}

function openEdit(row: ServiceOrder) {
  if (!canWriteOrders.value) return
  fillForm(row)
  formMode.value = 'edit'
  formVisible.value = true
}

async function openDetail(row: ServiceOrder) {
  currentOrder.value = await serviceOrderApi.detail(row.id).catch(() => row)
  detailVisible.value = true
}

function openDispatch(row: ServiceOrder) {
  if (!canWriteOrders.value) return
  currentOrder.value = row
  dispatchForm.nurseId = row.nurseId ?? null
  dispatchVisible.value = true
}

async function submitForm() {
  if (!canWriteOrders.value) return
  try {
    const payload = buildPayload()
    if (formMode.value === 'create') {
      await serviceOrderApi.create(payload)
      ElMessage.success('订单已创建')
    } else if (form.id) {
      await serviceOrderApi.update(form.id, payload)
      ElMessage.success('订单已更新')
    }
    formVisible.value = false
    await loadOrders()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

async function submitDispatch() {
  if (!canWriteOrders.value || !currentOrder.value || !dispatchForm.nurseId) {
    ElMessage.warning('请选择护理人员')
    return
  }
  const nurse = nurses.value.find((item) => item.id === dispatchForm.nurseId)
  await serviceOrderApi.dispatch(currentOrder.value.id, dispatchForm.nurseId, nurse?.name ?? '')
  ElMessage.success('派单成功')
  dispatchVisible.value = false
  await loadOrders()
}

async function markPayment(row: ServiceOrder, status: 'PAID' | 'FAILED') {
  if (!canWriteOrders.value) return
  if (!row.payAmount) {
    ElMessage.warning('请先设置支付金额')
    return
  }
  const payment = await paymentApi.create({ orderId: row.id, amount: row.payAmount, channel: 'MOCK' })
  await paymentApi.mockCallback(payment.id, {
    status,
    tradeNo: status === 'PAID' ? `MOCK-${row.id}-${Date.now()}` : undefined,
  })
  ElMessage.success(status === 'PAID' ? '支付已标记成功' : '支付已标记失败')
  await loadOrders()
}

async function updateStatus(row: ServiceOrder, status: ServiceOrderStatus) {
  if (!canWriteOrders.value) return
  await ElMessageBox.confirm(`确认将订单 #${row.id} 标记为 ${statusLabel(status)} 吗？`, '提示', { type: 'warning' })
  await serviceOrderApi.updateStatus(row.id, status)
  ElMessage.success('订单状态已更新')
  await loadOrders()
}

async function removeOrder(row: ServiceOrder) {
  if (!canWriteOrders.value) return
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
      预约类型: orderTypeLabel(item),
      状态: statusLabel(item.status),
      联系人: item.contactName || '-',
      联系电话: item.contactPhone || '-',
      服务地址: item.serviceAddress || '-',
      预约时间: item.appointmentTime ? dayjs(item.appointmentTime).format('YYYY-MM-DD HH:mm') : '-',
      护理人员: item.nurseName || '-',
      支付状态: item.payStatus || 'UNPAID',
      支付金额: item.payAmount || '-',
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
        <el-button v-if="canWriteOrders" type="primary" @click="openCreate">新建订单</el-button>
      </div>
    </div>

    <div class="stats-grid">
      <el-card class="page-card stat-card"><div class="stat-label">订单总数</div><div class="stat-value">{{ summary.total }}</div></el-card>
      <el-card class="page-card stat-card"><div class="stat-label">当前页待处理</div><div class="stat-value warning">{{ summary.pending }}</div></el-card>
      <el-card class="page-card stat-card"><div class="stat-label">当前页已接单</div><div class="stat-value primary">{{ summary.accepted }}</div></el-card>
      <el-card class="page-card stat-card"><div class="stat-label">当前页已完成</div><div class="stat-value success">{{ summary.completed }}</div></el-card>
    </div>

    <el-card class="page-card" style="margin-top: 16px;">
      <div class="page-toolbar">
        <el-input v-model="filters.keyword" placeholder="搜索订单、联系人、地址、护理人员" clearable style="width: 280px" @keyup.enter="resetAndLoadOrders" />
        <el-select v-model="filters.orderType" placeholder="预约类型" clearable style="width: 180px">
          <el-option label="送药上门" value="MEDICINE_DELIVERY" />
          <el-option label="上门访问" value="HOME_VISIT" />
          <el-option label="体检预约" value="PHYSICAL_EXAM" />
        </el-select>
        <el-select v-model="filters.status" placeholder="订单状态" style="width: 180px">
          <el-option label="全部状态" value="ALL" />
          <el-option label="待处理" value="PENDING" />
          <el-option label="已接单" value="ACCEPTED" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
        <el-button type="primary" @click="resetAndLoadOrders">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="id" label="订单ID" width="90" />
        <el-table-column label="预约类型" min-width="120"><template #default="{ row }">{{ orderTypeLabel(row) }}</template></el-table-column>
        <el-table-column label="预约时间" min-width="170"><template #default="{ row }">{{ row.appointmentTime ? dayjs(row.appointmentTime).format('YYYY-MM-DD HH:mm') : '-' }}</template></el-table-column>
        <el-table-column label="联系人" min-width="110"><template #default="{ row }">{{ row.contactName || '-' }}</template></el-table-column>
        <el-table-column label="联系电话" min-width="140"><template #default="{ row }">{{ row.contactPhone || '-' }}</template></el-table-column>
        <el-table-column label="服务地址" min-width="220" show-overflow-tooltip><template #default="{ row }">{{ row.serviceAddress || '-' }}</template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag>{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="护理人员" min-width="120"><template #default="{ row }">{{ row.nurseName || '-' }}</template></el-table-column>
        <el-table-column label="支付" width="140">
          <template #default="{ row }">
            <el-tag :type="row.payStatus === 'PAID' ? 'success' : row.payStatus === 'FAILED' ? 'danger' : 'warning'">{{ row.payStatus || 'UNPAID' }}</el-tag>
            <div class="pay-amount">{{ row.payAmount || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <template v-if="canWriteOrders">
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link @click="openDispatch(row)">派单</el-button>
                <el-button v-if="row.payStatus !== 'PAID'" link type="success" @click="markPayment(row, 'PAID')">支付</el-button>
                <el-button v-if="row.status !== 'COMPLETED'" link type="success" @click="updateStatus(row, 'COMPLETED')">完成</el-button>
                <el-button v-if="row.status !== 'CANCELED'" link type="warning" @click="updateStatus(row, 'CANCELED')">取消</el-button>
                <el-button link type="danger" @click="removeOrder(row)">删除</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        class="table-pagination"
        layout="total, sizes, prev, pager, next"
        :total="totalOrders"
        :page-sizes="[10, 20, 50]"
        @current-change="loadOrders"
        @size-change="resetAndLoadOrders"
      />
    </el-card>

    <el-drawer v-model="detailVisible" title="订单详情" size="560px">
      <el-descriptions v-if="currentOrder" :column="1" border>
        <el-descriptions-item label="订单ID">{{ currentOrder.id }}</el-descriptions-item>
        <el-descriptions-item label="预约类型">{{ orderTypeLabel(currentOrder) }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(currentOrder.status) }}</el-descriptions-item>
        <el-descriptions-item label="预约对象ID">{{ currentOrder.targetId }}</el-descriptions-item>
        <el-descriptions-item label="预约时间">{{ currentOrder.appointmentTime ? dayjs(currentOrder.appointmentTime).format('YYYY-MM-DD HH:mm:ss') : '-' }}</el-descriptions-item>
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
    </el-drawer>

    <el-dialog v-model="formVisible" :title="formMode === 'create' ? '新建预约订单' : '编辑预约订单'" width="760px">
      <el-form label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="预约类型" required><el-select v-model="form.orderType" style="width: 100%"><el-option label="送药上门" value="MEDICINE_DELIVERY" /><el-option label="上门访问" value="HOME_VISIT" /><el-option label="体检预约" value="PHYSICAL_EXAM" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="展示名称"><el-input v-model="form.displayType" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="预约对象" required><el-select v-model="form.targetId" filterable style="width: 100%"><el-option v-for="item in targets" :key="item.memberId" :label="item.name" :value="item.memberId" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="预约时间" required><el-date-picker v-model="form.appointmentTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="订单状态"><el-select v-model="form.status" style="width: 100%"><el-option label="待处理" value="PENDING" /><el-option label="已接单" value="ACCEPTED" /><el-option label="已完成" value="COMPLETED" /><el-option label="已取消" value="CANCELED" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="护理人员"><el-select v-model="form.nurseId" clearable filterable style="width: 100%"><el-option v-for="item in nurses" :key="item.id" :label="`${item.name}${item.phone ? ` (${item.phone})` : ''}`" :value="item.id" /></el-select></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contactName" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="服务地址"><el-input v-model="form.serviceAddress" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="药品清单"><el-input v-model="form.medicineList" type="textarea" :rows="2" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="补充说明"><el-input v-model="form.requirement" type="textarea" :rows="3" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="支付状态"><el-input v-model="form.payStatus" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="支付金额"><el-input v-model="form.payAmount" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="回访记录"><el-input v-model="form.visitRemark" type="textarea" :rows="3" /></el-form-item></el-col>
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
.header-actions,
.page-toolbar,
.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
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

.stat-value.primary { color: #3b82f6; }
.stat-value.warning { color: #f59e0b; }
.stat-value.success { color: #10b981; }

.pay-amount {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.table-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
