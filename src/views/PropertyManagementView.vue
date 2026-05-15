<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { propertyManagementApi } from '@/api/modules'
import type { PropertyManagement } from '@/types'

const loading = ref(false)
const list = ref<PropertyManagement[]>([])
const keyword = ref('')
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  name: '',
  contactName: '',
  contactPhone: '',
  serviceArea: '',
  address: '',
  remark: '',
})

async function loadData() {
  loading.value = true
  try {
    list.value = await propertyManagementApi.list({ keyword: keyword.value.trim() || undefined })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.contactName = ''
  form.contactPhone = ''
  form.serviceArea = ''
  form.address = ''
  form.remark = ''
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: PropertyManagement) {
  editingId.value = row.id
  form.name = row.name
  form.contactName = row.contactName || ''
  form.contactPhone = row.contactPhone || ''
  form.serviceArea = row.serviceArea || ''
  form.address = row.address || ''
  form.remark = row.remark || ''
  dialogVisible.value = true
}

async function submitForm() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入物业名称')
    return
  }
  const payload = { ...form }
  if (editingId.value) {
    await propertyManagementApi.update(editingId.value, payload)
    ElMessage.success('物业信息已更新')
  } else {
    await propertyManagementApi.create(payload)
    ElMessage.success('物业信息已创建')
  }
  dialogVisible.value = false
  await loadData()
}

async function removeItem(row: PropertyManagement) {
  await ElMessageBox.confirm(`确认删除 ${row.name} 吗？`, '提示', { type: 'warning' })
  await propertyManagementApi.delete(row.id)
  ElMessage.success('已删除')
  await loadData()
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">物业信息维护</span>
      <el-button type="primary" @click="openCreate">新增物业</el-button>
    </div>

    <el-card class="page-card">
      <div class="page-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索物业、联系人、电话、区域" style="width: 320px" @keyup.enter="loadData" />
        <el-button type="primary" @click="loadData">查询</el-button>
      </div>

      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="name" label="物业名称" min-width="160" />
        <el-table-column prop="contactName" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="电话" width="150" />
        <el-table-column prop="serviceArea" label="服务区域" min-width="180" />
        <el-table-column prop="address" label="地址" min-width="220" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeItem(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑物业' : '新增物业'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="物业名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactName" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.contactPhone" /></el-form-item>
        <el-form-item label="服务区域"><el-input v-model="form.serviceArea" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
