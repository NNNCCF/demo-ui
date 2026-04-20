<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { feedbackAdminApi } from '@/api/modules'
import type { FeedbackItem } from '@/types'

const loading = ref(false)
const tableData = ref<FeedbackItem[]>([])
const detailVisible = ref(false)
const currentItem = ref<FeedbackItem | null>(null)

const filters = reactive({
  status: '',
  type: '',
  submitterRole: '',
  keyword: '',
})

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'NEW' },
  { label: '处理中', value: 'IN_PROGRESS' },
  { label: '已解决', value: 'RESOLVED' },
]

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '功能异常', value: 'bug' },
  { label: '体验问题', value: 'exp' },
  { label: '体验问题', value: 'ux' },
  { label: '功能建议', value: 'suggest' },
  { label: '功能建议', value: 'suggestion' },
  { label: '其他', value: 'other' },
]

const roleOptions = [
  { label: '全部角色', value: '' },
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

function openDetail(row: FeedbackItem) {
  currentItem.value = row
  detailVisible.value = true
}

async function changeStatus(row: FeedbackItem, status: string) {
  const statusText = statusLabel(status)
  await ElMessageBox.confirm(`确认将反馈 #${row.id} 标记为“${statusText}”吗？`, '状态更新', {
    type: 'warning',
  })
  await feedbackAdminApi.updateStatus(row.id, status)
  ElMessage.success('反馈状态已更新')
  if (currentItem.value?.id === row.id) {
    currentItem.value = { ...currentItem.value, status }
  }
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
  switch (type) {
    case 'bug':
      return '功能异常'
    case 'exp':
    case 'ux':
      return '体验问题'
    case 'suggest':
    case 'suggestion':
      return '功能建议'
    case 'other':
      return '其他'
    default:
      return type || '-'
  }
}

function roleLabel(role?: string) {
  switch (role) {
    case 'GUARDIAN':
      return '家属'
    case 'CAREGIVER':
      return '医护'
    case 'INSTITUTION':
      return '机构'
    case 'NURSE':
      return '护士'
    case 'DOCTOR':
      return '医生'
    case 'ADMIN':
      return '管理员'
    default:
      return role || '-'
  }
}

function shortContent(content: string) {
  if (!content) return '-'
  return content.length > 38 ? `${content.slice(0, 38)}...` : content
}

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">意见反馈</span>
      <el-button @click="loadList">刷新</el-button>
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
        <el-select v-model="filters.status" placeholder="处理状态" clearable style="width: 160px;">
          <el-option v-for="item in statusOptions" :key="item.value || 'all-status'" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.type" placeholder="反馈类型" clearable style="width: 160px;">
          <el-option v-for="item in typeOptions" :key="`${item.value || 'all-type'}-${item.label}`" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.submitterRole" placeholder="提交角色" clearable style="width: 160px;">
          <el-option v-for="item in roleOptions" :key="item.value || 'all-role'" :label="item.label" :value="item.value" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          placeholder="搜索反馈内容、提交人、编号"
          clearable
          style="width: 260px;"
          @keyup.enter="loadList"
        />
        <el-button type="primary" @click="loadList">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" border>
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column label="提交人" min-width="150">
          <template #default="{ row }">
            <div class="submitter-cell">
              <div class="submitter-name">{{ row.submitterName || `用户#${row.submitterId}` }}</div>
              <div class="submitter-meta">{{ roleLabel(row.submitterRole) }} · ID {{ row.submitterId || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag effect="plain">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">{{ shortContent(row.content) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看详情</el-button>
            <el-button
              v-if="row.status === 'NEW'"
              link
              type="warning"
              @click="changeStatus(row, 'IN_PROGRESS')"
            >
              设为处理中
            </el-button>
            <el-button
              v-if="row.status !== 'RESOLVED'"
              link
              type="success"
              @click="changeStatus(row, 'RESOLVED')"
            >
              标记解决
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && tableData.length === 0" description="暂无意见反馈" />
    </el-card>
  </div>

  <el-drawer v-model="detailVisible" title="反馈详情" size="520px">
    <template v-if="currentItem">
      <div class="detail-block">
        <p class="section-title">基础信息</p>
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
        </el-descriptions>
      </div>

      <div class="detail-block">
        <p class="section-title">反馈内容</p>
        <div class="content-box">{{ currentItem.content }}</div>
      </div>

      <div class="detail-actions">
        <el-button
          v-if="currentItem.status === 'NEW'"
          type="warning"
          plain
          @click="changeStatus(currentItem, 'IN_PROGRESS')"
        >
          设为处理中
        </el-button>
        <el-button
          v-if="currentItem.status !== 'RESOLVED'"
          type="success"
          @click="changeStatus(currentItem, 'RESOLVED')"
        >
          标记解决
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
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
  color: #22c55e;
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

.detail-block + .detail-block {
  margin-top: 24px;
}

.content-box {
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

@media (max-width: 1440px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
