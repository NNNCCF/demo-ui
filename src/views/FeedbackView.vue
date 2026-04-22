<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { feedbackAdminApi } from '@/api/modules'
import type { FeedbackItem } from '@/types'

const loading = ref(false)
const tableData = ref<FeedbackItem[]>([])
const detailVisible = ref(false)
const formVisible = ref(false)
const currentItem = ref<FeedbackItem | null>(null)
const formMode = ref<'create' | 'edit'>('create')

const filters = reactive({
  status: '',
  type: '',
  submitterRole: '',
  keyword: '',
})

const form = reactive({
  id: null as number | null,
  submitterId: null as number | null,
  submitterRole: 'GUARDIAN',
  type: 'suggestion',
  content: '',
  status: 'NEW',
})

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'NEW' },
  { label: '处理中', value: 'IN_PROGRESS' },
  { label: '已解决', value: 'RESOLVED' },
]

const typeOptions = [
  { label: '功能异常', value: 'bug' },
  { label: '体验问题', value: 'ux' },
  { label: '功能建议', value: 'suggestion' },
  { label: '其他', value: 'other' },
]

const roleOptions = [
  { label: '家属', value: 'GUARDIAN' },
  { label: '医护', value: 'CAREGIVER' },
  { label: '机构', value: 'INSTITUTION' },
  { label: '护士', value: 'NURSE' },
  { label: '医生', value: 'DOCTOR' },
  { label: '管理员', value: 'ADMIN' },
]

const summary = computed(() => ({
  total: tableData.value.length,
  pending: tableData.value.filter((item) => item.status === 'NEW').length,
  processing: tableData.value.filter((item) => item.status === 'IN_PROGRESS').length,
  resolved: tableData.value.filter((item) => item.status === 'RESOLVED').length,
}))

function resetForm() {
  form.id = null
  form.submitterId = null
  form.submitterRole = 'GUARDIAN'
  form.type = 'suggestion'
  form.content = ''
  form.status = 'NEW'
}

function fillForm(row: FeedbackItem) {
  form.id = row.id
  form.submitterId = row.submitterId ?? null
  form.submitterRole = row.submitterRole || 'GUARDIAN'
  form.type = row.type || 'suggestion'
  form.content = row.content || ''
  form.status = row.status || 'NEW'
}

async function loadList() {
  loading.value = true
  try {
    tableData.value = await feedbackAdminApi.list({
      status: filters.status || undefined,
      type: filters.type || undefined,
      submitterRole: filters.submitterRole || undefined,
      keyword: filters.keyword.trim() || undefined,
    })
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.status = ''
  filters.type = ''
  filters.submitterRole = ''
  filters.keyword = ''
  void loadList()
}

async function openDetail(row: FeedbackItem) {
  currentItem.value = await feedbackAdminApi.detail(row.id).catch(() => row)
  detailVisible.value = true
}

function openCreate() {
  resetForm()
  formMode.value = 'create'
  formVisible.value = true
}

function openEdit(row: FeedbackItem) {
  fillForm(row)
  formMode.value = 'edit'
  formVisible.value = true
}

async function submitForm() {
  if (!form.content.trim()) {
    ElMessage.warning('请填写反馈内容')
    return
  }

  const payload = {
    submitterId: form.submitterId || undefined,
    submitterRole: form.submitterRole || undefined,
    type: form.type,
    content: form.content.trim(),
    status: form.status,
  }

  if (formMode.value === 'create') {
    await feedbackAdminApi.create(payload)
    ElMessage.success('反馈已创建')
  } else if (form.id) {
    await feedbackAdminApi.update(form.id, payload)
    ElMessage.success('反馈已更新')
  }

  formVisible.value = false
  await loadList()
}

async function changeStatus(row: FeedbackItem, status: string) {
  await ElMessageBox.confirm(`确认将反馈 #${row.id} 更新为 ${statusLabel(status)} 吗？`, '提示', { type: 'warning' })
  await feedbackAdminApi.updateStatus(row.id, status)
  ElMessage.success('反馈状态已更新')
  if (currentItem.value?.id === row.id) {
    currentItem.value = { ...currentItem.value, status }
  }
  await loadList()
}

async function removeItem(row: FeedbackItem) {
  await ElMessageBox.confirm(`确认删除反馈 #${row.id} 吗？`, '提示', { type: 'warning' })
  await feedbackAdminApi.delete(row.id)
  ElMessage.success('反馈已删除')
  detailVisible.value = false
  await loadList()
}

function statusLabel(status: string) {
  return statusOptions.find((item) => item.value === status)?.label || status
}

function statusTagType(status: string) {
  if (status === 'RESOLVED') return 'success'
  if (status === 'IN_PROGRESS') return 'warning'
  return 'danger'
}

function typeLabel(type: string) {
  return typeOptions.find((item) => item.value === type)?.label || type || '-'
}

function roleLabel(role?: string) {
  return roleOptions.find((item) => item.value === role)?.label || role || '-'
}

function shortContent(content: string) {
  if (!content) return '-'
  return content.length > 42 ? `${content.slice(0, 42)}...` : content
}

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">意见反馈管理</span>
      <div class="header-actions">
        <el-button @click="loadList">刷新</el-button>
        <el-button type="primary" @click="openCreate">新建反馈</el-button>
      </div>
    </div>

    <div class="stats-grid">
      <el-card class="page-card stat-card">
        <div class="stat-label">反馈总数</div>
        <div class="stat-value">{{ summary.total }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">待处理</div>
        <div class="stat-value danger">{{ summary.pending }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">处理中</div>
        <div class="stat-value warning">{{ summary.processing }}</div>
      </el-card>
      <el-card class="page-card stat-card">
        <div class="stat-label">已解决</div>
        <div class="stat-value success">{{ summary.resolved }}</div>
      </el-card>
    </div>

    <el-card class="page-card" style="margin-top: 16px;">
      <div class="page-toolbar">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 160px;">
          <el-option v-for="item in statusOptions" :key="item.value || 'all-status'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 160px;">
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.submitterRole" placeholder="提交角色" clearable style="width: 160px;">
          <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="搜索内容、提交人、编号"
          clearable
          style="width: 260px;"
          @keyup.enter="loadList"
        />
        <el-button type="primary" @click="loadList">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" border>
        <el-table-column prop="id" label="编号" width="90" />
        <el-table-column label="提交人" min-width="170">
          <template #default="{ row }">
            <div class="submitter-cell">
              <div class="submitter-name">{{ row.submitterName || `用户#${row.submitterId}` }}</div>
              <div class="submitter-meta">{{ roleLabel(row.submitterRole) }} · ID {{ row.submitterId || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag effect="plain">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" min-width="340" show-overflow-tooltip>
          <template #default="{ row }">{{ shortContent(row.content) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button link @click="openEdit(row)">编辑</el-button>
              <el-button v-if="row.status === 'NEW'" link type="warning" @click="changeStatus(row, 'IN_PROGRESS')">处理中</el-button>
              <el-button v-if="row.status !== 'RESOLVED'" link type="success" @click="changeStatus(row, 'RESOLVED')">已解决</el-button>
              <el-button link type="danger" @click="removeItem(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" title="反馈详情" size="560px">
      <template v-if="currentItem">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="反馈编号">{{ currentItem.id }}</el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ currentItem.submitterName || `用户#${currentItem.submitterId}` }}
          </el-descriptions-item>
          <el-descriptions-item label="提交角色">{{ roleLabel(currentItem.submitterRole) }}</el-descriptions-item>
          <el-descriptions-item label="反馈类型">{{ typeLabel(currentItem.type) }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">
            <el-tag :type="statusTagType(currentItem.status)">{{ statusLabel(currentItem.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ dayjs(currentItem.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ currentItem.updatedAt ? dayjs(currentItem.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="反馈内容">
            <div class="content-box">{{ currentItem.content }}</div>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-actions">
          <el-button @click="openEdit(currentItem)">编辑</el-button>
          <el-button v-if="currentItem.status === 'NEW'" type="warning" plain @click="changeStatus(currentItem, 'IN_PROGRESS')">设为处理中</el-button>
          <el-button v-if="currentItem.status !== 'RESOLVED'" type="success" @click="changeStatus(currentItem, 'RESOLVED')">标记已解决</el-button>
          <el-button type="danger" plain @click="removeItem(currentItem)">删除</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="formVisible" :title="formMode === 'create' ? '新建反馈' : '编辑反馈'" width="620px">
      <el-form label-width="110px">
        <el-form-item label="提交人ID">
          <el-input-number v-model="form.submitterId" :min="1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="提交角色">
          <el-select v-model="form.submitterRole" style="width: 100%">
            <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="反馈类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="待处理" value="NEW" />
            <el-option label="处理中" value="IN_PROGRESS" />
            <el-option label="已解决" value="RESOLVED" />
          </el-select>
        </el-form-item>
        <el-form-item label="反馈内容" required>
          <el-input v-model="form.content" type="textarea" :rows="6" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
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
  padding: 6px 4px;
}

.stat-label {
  color: #64748b;
  font-size: 13px;
}

.stat-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.stat-value.danger {
  color: #ef4444;
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

.submitter-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submitter-name {
  color: #0f172a;
  font-weight: 600;
}

.submitter-meta {
  color: #64748b;
  font-size: 12px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.content-box {
  white-space: pre-wrap;
  line-height: 1.7;
  color: #334155;
}

.detail-actions {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 1440px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
