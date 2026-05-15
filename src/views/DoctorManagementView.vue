<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { doctorApi, organizationApi } from '@/api/modules'
import type { Doctor } from '@/types'

const list = ref<Doctor[]>([])
const loading = ref(false)
const orgList = ref<{ id: number; name: string }[]>([])

const filterOrgId = ref<number | null>(null)
const keyword = ref('')

const filteredList = computed(() => {
  let data = list.value
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    data = data.filter(d => d.name.toLowerCase().includes(kw) || d.mobile.includes(kw))
  }
  return data
})

async function loadList() {
  loading.value = true
  try {
    list.value = await doctorApi.list(filterOrgId.value ?? undefined)
  } finally {
    loading.value = false
  }
}

async function loadOrgs() {
  orgList.value = await organizationApi.list().catch(() => [])
}

// ---- edit dialog ----
const editVisible = ref(false)
const isCreate = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  mobile: '',
  name: '',
  password: '',
  introduction: '',
  title: '',
  orgId: null as number | null,
})

function openCreate() {
  isCreate.value = true
  editingId.value = null
  form.mobile = ''
  form.name = ''
  form.password = ''
  form.introduction = ''
  form.title = ''
  form.orgId = null
  editVisible.value = true
}

function openEdit(row: Doctor) {
  isCreate.value = false
  editingId.value = row.id
  form.mobile = row.mobile
  form.name = row.name
  form.password = ''
  form.introduction = row.introduction ?? ''
  form.title = row.title ?? ''
  form.orgId = row.orgId
  editVisible.value = true
}

async function submitForm() {
  if (!form.name.trim() || !form.mobile.trim()) {
    ElMessage.warning('请填写姓名和手机号')
    return
  }
  if (form.orgId === null) {
    ElMessage.warning('请选择所属机构')
    return
  }
  if (isCreate.value && !form.password) {
    ElMessage.warning('新建医生时请填写初始密码')
    return
  }

  if (isCreate.value) {
    await doctorApi.create({
      mobile: form.mobile,
      name: form.name,
      password: form.password,
      introduction: form.introduction || undefined,
      title: form.title || undefined,
      orgId: form.orgId,
    })
    ElMessage.success('医生创建成功')
  } else {
    await doctorApi.update(editingId.value!, {
      mobile: form.mobile,
      name: form.name,
      introduction: form.introduction || undefined,
      title: form.title || undefined,
      orgId: form.orgId,
    })
    ElMessage.success('医生信息已更新')
  }
  editVisible.value = false
  await loadList()
}

async function deleteDoctor(row: Doctor) {
  await ElMessageBox.confirm(`确认删除医生 "${row.name}" 吗？`, '提示', { type: 'warning' })
  await doctorApi.delete(row.id)
  ElMessage.success('已删除')
  await loadList()
}

function orgName(orgId: number) {
  return orgList.value.find(o => o.id === orgId)?.name ?? String(orgId)
}

onMounted(() => {
  void loadOrgs()
  void loadList()
})
</script>

<template>
  <el-card class="page-card">
    <template #header>
      <div class="head">
        <span>医生管理</span>
        <el-button type="primary" @click="openCreate">新增医生</el-button>
      </div>
    </template>

    <div class="filter-bar">
      <el-select
        v-model="filterOrgId"
        placeholder="所属机构"
        clearable
        style="width: 200px"
        @change="loadList"
      >
        <el-option v-for="o in orgList" :key="o.id" :label="o.name" :value="o.id" />
      </el-select>
      <el-input
        v-model="keyword"
        placeholder="姓名 / 手机号搜索..."
        clearable
        style="width: 220px"
      />
    </div>

    <el-table v-loading="loading" :data="filteredList" border style="margin-top: 12px">
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="name" label="姓名" min-width="120" />
      <el-table-column prop="mobile" label="手机号" min-width="140" />
      <el-table-column prop="title" label="职称" min-width="120" />
      <el-table-column label="所属机构" min-width="160">
        <template #default="{ row }">{{ orgName(row.orgId) }}</template>
      </el-table-column>
      <el-table-column prop="introduction" label="简介" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="deleteDoctor(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="editVisible" :title="isCreate ? '新增医生' : '编辑医生'" width="500px">
    <el-form :model="form" label-width="90px">
      <el-form-item label="姓名" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="手机号" required>
        <el-input v-model="form.mobile" />
      </el-form-item>
      <el-form-item v-if="isCreate" label="初始密码" required>
        <el-input v-model="form.password" type="password" show-password placeholder="不少于6位" />
      </el-form-item>
      <el-form-item label="职称">
        <el-input v-model="form.title" placeholder="如：主任医师" />
      </el-form-item>
      <el-form-item label="所属机构" required>
        <el-select v-model="form.orgId" style="width: 100%">
          <el-option v-for="o in orgList" :key="o.id" :label="o.name" :value="o.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-model="form.introduction" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
}

.filter-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
