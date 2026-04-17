<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { familyApi, organizationApi, clientUserApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isAdmin = authStore.userInfo?.role === 'ADMIN'

const families = ref<any[]>([])
const orgs = ref<any[]>([])
const clients = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const guardianDialogVisible = ref(false)
const editingId = ref<number | null>(null)
const selectedFamilyId = ref<number | null>(null)

const form = reactive({ name: '', address: '', orgId: null as number | null })
const guardianForm = reactive({ clientUserId: null as number | null })

// --- 详情抽屉 ---
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)

async function openDetail(row: any) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await familyApi.detail(row.id)
  } finally {
    detailLoading.value = false
  }
}

function deviceStatusLabel(status: string) {
  const map: Record<string, string> = { ONLINE: '在线', OFFLINE: '离线', DISABLED: '禁用' }
  return map[status] ?? status
}

function deviceStatusType(status: string) {
  const map: Record<string, string> = { ONLINE: 'success', OFFLINE: 'info', DISABLED: 'danger' }
  return map[status] ?? 'info'
}

// --- 列表数据 ---
async function loadAll() {
  loading.value = true
  try {
    const [fList, cList] = await Promise.all([
      familyApi.list(),
      clientUserApi.list(),
    ])
    families.value = fList
    clients.value = cList.filter((c: any) => c.role === 'GUARDIAN')
    if (isAdmin) orgs.value = await organizationApi.list()
  } finally {
    loading.value = false
  }
}

function orgName(orgId: number) {
  return orgs.value.find(o => o.id === orgId)?.name ?? orgId
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', address: '', orgId: null })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, { name: row.name, address: row.address ?? '', orgId: row.orgId })
  dialogVisible.value = true
}

async function saveFamily() {
  if (!form.name) { ElMessage.error('家庭名称不能为空'); return }
  try {
    if (editingId.value) {
      await familyApi.update(editingId.value, { name: form.name, address: form.address || undefined })
    } else {
      await familyApi.create({ name: form.name, address: form.address || undefined, orgId: form.orgId || undefined })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadAll()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function deleteFamily(row: any) {
  await ElMessageBox.confirm(`确认删除家庭「${row.name}」？`, '提示', { type: 'warning' })
  await familyApi.delete(row.id)
  ElMessage.success('已删除')
  loadAll()
}

function openAddGuardian(familyId: number) {
  selectedFamilyId.value = familyId
  guardianForm.clientUserId = null
  guardianDialogVisible.value = true
}

async function addGuardian() {
  if (!guardianForm.clientUserId || !selectedFamilyId.value) return
  try {
    await familyApi.addGuardian(selectedFamilyId.value, guardianForm.clientUserId)
    ElMessage.success('监护人已添加')
    guardianDialogVisible.value = false
    loadAll()
  } catch (e: any) {
    ElMessage.error(e.message || '添加失败')
  }
}

async function removeGuardian(familyId: number, clientUserId: number) {
  await familyApi.removeGuardian(familyId, clientUserId)
  ElMessage.success('已移除')
  loadAll()
}

onMounted(loadAll)
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">家庭管理</span>
      <el-button type="primary" @click="openCreate">新增家庭</el-button>
    </div>

    <el-card class="page-card" v-loading="loading">
      <el-table :data="families" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="家庭名称" min-width="130">
          <template #default="{ row }">
            <el-link type="primary" @click="openDetail(row)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="160" show-overflow-tooltip />
        <el-table-column label="所属机构" v-if="isAdmin" min-width="120">
          <template #default="{ row }">{{ orgName(row.orgId) }}</template>
        </el-table-column>
        <el-table-column label="监护人" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="g in row.guardians"
              :key="g.id"
              closable
              size="small"
              style="margin-right: 4px"
              @close="removeGuardian(row.id, g.id)"
            >{{ g.name || g.mobile }}</el-tag>
            <el-button size="small" link @click="openAddGuardian(row.id)">+ 添加</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteFamily(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 家庭详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detail ? `${detail.name} — 家庭详情` : '家庭详情'" size="600px" direction="rtl">
      <div v-if="detailLoading" v-loading="true" style="height: 200px" />
      <div v-else-if="detail">
        <!-- 基本信息 -->
        <div class="section-title">基本信息</div>
        <el-descriptions :column="2" border size="small" style="margin-bottom: 20px">
          <el-descriptions-item label="家庭名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="详细地址">{{ detail.address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="所属社区" v-if="isAdmin">{{ orgName(detail.orgId) }}</el-descriptions-item>
        </el-descriptions>

        <!-- 监护人 -->
        <div class="section-title">监护人（{{ detail.guardians?.length ?? 0 }} 位）</div>
        <el-table :data="detail.guardians" border size="small" style="margin-bottom: 20px">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="姓名" />
          <el-table-column prop="mobile" label="手机号" />
        </el-table>

        <!-- 设备 -->
        <div class="section-title">绑定设备（{{ detail.devices?.length ?? 0 }} 台）</div>
        <el-table :data="detail.devices" border size="small" style="margin-bottom: 20px">
          <el-table-column prop="deviceId" label="设备号" min-width="130" />
          <el-table-column label="位置" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ [row.homeLocation, row.address, row.roomNumber].filter(Boolean).join(' ') || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="deviceStatusType(row.status)" size="small">{{ deviceStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="被监护人" min-width="120">
            <template #default="{ row }">
              <span v-if="row.wards && row.wards.length">{{ row.wards.map((w: any) => w.name).join('、') }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="所属机构/物业" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.medicalInstitution">{{ row.medicalInstitution }}</span>
              <span v-if="row.medicalInstitution && row.propertyManagement"> / </span>
              <span v-if="row.propertyManagement">{{ row.propertyManagement }}</span>
              <span v-if="!row.medicalInstitution && !row.propertyManagement">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <!-- 新增/编辑家庭 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑家庭' : '新增家庭'" width="440px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="家庭名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" placeholder="如：1号楼2单元101" /></el-form-item>
        <el-form-item label="所属社区" v-if="isAdmin && !editingId">
          <el-select v-model="form.orgId" placeholder="请选择社区机构" clearable>
            <el-option
              v-for="o in orgs.filter((o: any) => o.type === 'COMMUNITY')"
              :key="o.id"
              :label="o.name"
              :value="o.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFamily">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加监护人 -->
    <el-dialog v-model="guardianDialogVisible" title="添加监护人" width="380px">
      <el-form :model="guardianForm" label-width="80px">
        <el-form-item label="选择用户">
          <el-select v-model="guardianForm.clientUserId" placeholder="请选择监护人" filterable>
            <el-option v-for="c in clients" :key="c.id" :label="`${c.name ?? ''} (${c.mobile})`" :value="c.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="guardianDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addGuardian">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
</style>
