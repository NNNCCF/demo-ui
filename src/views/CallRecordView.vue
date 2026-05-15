<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { callRecordApi } from '@/api/modules'
import type { CallRecord } from '@/types'

const loading = ref(false)
const list = ref<CallRecord[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  callerName: '',
  phone: '',
  content: '',
  handlerName: '',
  durationSeconds: 0,
})

async function loadData() {
  loading.value = true
  try {
    list.value = await callRecordApi.list({ keyword: keyword.value.trim() || undefined })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.callerName = ''
  form.phone = ''
  form.content = ''
  form.handlerName = ''
  form.durationSeconds = 0
  dialogVisible.value = true
}

function openEdit(row: CallRecord) {
  editingId.value = row.id
  form.callerName = row.callerName
  form.phone = row.phone
  form.content = row.content || ''
  form.handlerName = row.handlerName || ''
  form.durationSeconds = row.durationSeconds || 0
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.callerName.trim() || !form.phone.trim()) {
    ElMessage.warning('请填写来电人和电话')
    return
  }
  const payload = { ...form }
  if (editingId.value) {
    await callRecordApi.update(editingId.value, payload)
    ElMessage.success('电话记录已更新')
  } else {
    await callRecordApi.create(payload)
    ElMessage.success('电话记录已创建')
  }
  dialogVisible.value = false
  await loadData()
}

async function removeItem(row: CallRecord) {
  await ElMessageBox.confirm(`确认删除 ${row.callerName} 的电话记录吗？`, '提示', { type: 'warning' })
  await callRecordApi.delete(row.id)
  ElMessage.success('已删除')
  await loadData()
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">客服电话记录</span>
      <el-button type="primary" @click="openCreate">新增记录</el-button>
    </div>

    <el-card class="page-card">
      <div class="page-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索来电人、电话、内容、处理人" style="width: 320px" @keyup.enter="loadData" />
        <el-button type="primary" @click="loadData">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="callerName" label="来电人" width="130" />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
        <el-table-column prop="handlerName" label="处理人" width="130" />
        <el-table-column prop="durationSeconds" label="时长(秒)" width="110" />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeItem(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑电话记录' : '新增电话记录'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="来电人" required><el-input v-model="form.callerName" /></el-form-item>
        <el-form-item label="电话" required><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="处理人"><el-input v-model="form.handlerName" /></el-form-item>
        <el-form-item label="时长(秒)"><el-input-number v-model="form.durationSeconds" :min="0" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
