<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { organizationApi, clientUserApi, institutionAdminApi, familyApi, caregiverApi } from '@/api/modules'
import type { ClientUser } from '@/types'

const orgs = ref<any[]>([])
const allClientUsers = ref<ClientUser[]>([])
const allFamilies = ref<any[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const userDialogVisible = ref(false)
const assignCaregiverVisible = ref(false)
const expandedOrgId = ref<number | null>(null)

const form = reactive({ name: '', type: 'MEDICAL_INSTITUTION', region: '', contactPhone: '' })
const userForm = reactive({ name: '', password: '', phone: '', orgId: 0 })
const assignForm = reactive({ caregiverId: null as number | null, orgId: 0 })
const assignLoading = ref(false)

async function loadOrgs() {
  loading.value = true
  try {
    const [orgList, users, fList] = await Promise.all([
      organizationApi.list(),
      clientUserApi.list(),
      familyApi.list(),
    ])
    orgs.value = orgList
    allClientUsers.value = users as ClientUser[]
    allFamilies.value = fList as any[]
  } finally {
    loading.value = false
  }
}

/** 获取某机构的机构管理员 */
function getOrgAdmins(orgId: number) {
  return allClientUsers.value.filter(u => u.orgId === orgId && u.role === 'INSTITUTION')
}

/** 获取某机构的医护人员 */
function getOrgCaregivers(orgId: number) {
  return allClientUsers.value.filter(u => u.orgId === orgId && u.role === 'CAREGIVER')
}

/** 获取某护工管辖的家庭（caregiverId 匹配） */
function getCaregiverFamilies(caregiverId: number) {
  return allFamilies.value.filter((f: any) => f.caregiverId === caregiverId)
}

/** 未分配到任何机构的护工（供机构添加使用） */
const unassignedCaregivers = () =>
  allClientUsers.value.filter(u => u.role === 'CAREGIVER' && !u.orgId)

function toggleExpand(orgId: number) {
  expandedOrgId.value = expandedOrgId.value === orgId ? null : orgId
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', type: 'MEDICAL_INSTITUTION', region: '', contactPhone: '' })
  dialogVisible.value = true
}

function openEdit(row: any) {
  editingId.value = row.id
  Object.assign(form, { name: row.name, type: row.type, region: row.region ?? '', contactPhone: row.contactPhone ?? '' })
  dialogVisible.value = true
}

async function saveOrg() {
  if (!form.name) { ElMessage.error('机构名称不能为空'); return }
  try {
    if (editingId.value) {
      await organizationApi.update(editingId.value, { ...form })
    } else {
      await organizationApi.create({ ...form })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadOrgs()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function toggleStatus(row: any) {
  const next = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const label = next === 'ENABLED' ? '启用' : '禁用'
  await ElMessageBox.confirm(`确认${label}机构「${row.name}」？`, '提示', { type: 'warning' })
  await organizationApi.setStatus(row.id, next as 'ENABLED' | 'DISABLED')
  ElMessage.success(`${label}成功`)
  loadOrgs()
}

function openCreateAdmin(org: any) {
  Object.assign(userForm, { name: '', password: '', phone: '', orgId: org.id })
  userDialogVisible.value = true
}

async function saveAdmin() {
  if (!userForm.name || !userForm.password || !userForm.phone) {
    ElMessage.error('姓名、手机号和密码不能为空')
    return
  }
  if (userForm.phone.length !== 11) {
    ElMessage.error('请输入正确的11位手机号')
    return
  }
  try {
    await institutionAdminApi.create({
      name: userForm.name,
      phone: userForm.phone,
      password: userForm.password,
      orgId: userForm.orgId
    })
    ElMessage.success('机构管理员创建成功')
    userDialogVisible.value = false
    loadOrgs()
  } catch (e: any) {
    ElMessage.error(e.message || '创建失败')
  }
}

function openAssignCaregiver(org: any) {
  Object.assign(assignForm, { caregiverId: null, orgId: org.id })
  assignCaregiverVisible.value = true
}

async function submitAssignCaregiver() {
  if (!assignForm.caregiverId) {
    ElMessage.warning('请选择要添加的医护人员')
    return
  }
  assignLoading.value = true
  try {
    await caregiverApi.assignOrg(assignForm.caregiverId, assignForm.orgId)
    ElMessage.success('医护人员已分配到机构')
    assignCaregiverVisible.value = false
    await loadOrgs()
  } catch (e: any) {
    ElMessage.error(e.message || '分配失败')
  } finally {
    assignLoading.value = false
  }
}

onMounted(loadOrgs)
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">机构管理</span>
      <el-button type="primary" @click="openCreate">新增机构</el-button>
    </div>

    <el-card class="page-card">
      <el-table :data="orgs" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="机构名称" />
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            {{ row.type === 'MEDICAL_INSTITUTION' ? '医疗机构' : '社区管理' }}
          </template>
        </el-table-column>
        <el-table-column prop="region" label="区域" />
        <el-table-column prop="contactPhone" label="联系电话" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ENABLED' ? 'success' : 'danger'">
              {{ row.status === 'ENABLED' ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="360">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="primary" @click="openCreateAdmin(row)">添加管理员</el-button>
            <el-button size="small" type="success" @click="openAssignCaregiver(row)">添加医护</el-button>
            <el-button size="small" type="info" @click="toggleExpand(row.id)">
              {{ expandedOrgId === row.id ? '收起' : '查看人员' }}
            </el-button>
            <el-button size="small" :type="row.status === 'ENABLED' ? 'danger' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'ENABLED' ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 展开的人员详情 -->
      <template v-for="org in orgs" :key="'detail-' + org.id">
        <div v-if="expandedOrgId === org.id" class="staff-detail-panel">
          <div class="staff-detail-header">
            <span class="staff-detail-title">「{{ org.name }}」人员详情</span>
          </div>

          <!-- 机构管理员 -->
          <div class="staff-section">
            <div class="staff-section-label">
              <el-tag type="warning" effect="dark" size="small">机构管理员</el-tag>
              <span class="staff-count">{{ getOrgAdmins(org.id).length }} 人</span>
            </div>
            <el-table v-if="getOrgAdmins(org.id).length > 0" :data="getOrgAdmins(org.id)" border size="small" class="sub-table">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column prop="name" label="姓名" min-width="100" />
              <el-table-column prop="mobile" label="手机号" min-width="130" />
              <el-table-column label="角色" width="120">
                <template #default><el-tag type="warning" size="small">机构管理员</el-tag></template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无机构管理员，点击「添加管理员」创建" :image-size="40" />
          </div>

          <!-- 医护人员 + 管辖家庭 -->
          <div class="staff-section">
            <div class="staff-section-label">
              <el-tag type="success" effect="dark" size="small">医护人员</el-tag>
              <span class="staff-count">{{ getOrgCaregivers(org.id).length }} 人</span>
            </div>
            <template v-if="getOrgCaregivers(org.id).length > 0">
              <div v-for="c in getOrgCaregivers(org.id)" :key="c.id" class="caregiver-row">
                <!-- 护工基本信息 -->
                <div class="caregiver-header">
                  <div class="caregiver-info">
                    <el-tag type="success" size="small" style="margin-right:8px">医护</el-tag>
                    <span class="caregiver-name">{{ c.name }}</span>
                    <span class="caregiver-mobile">{{ c.mobile }}</span>
                  </div>
                  <el-tag size="small" type="info">
                    管辖 {{ getCaregiverFamilies(c.id).length }} 户家庭
                  </el-tag>
                </div>
                <!-- 管辖家庭列表 -->
                <el-table
                  v-if="getCaregiverFamilies(c.id).length > 0"
                  :data="getCaregiverFamilies(c.id)"
                  border
                  size="small"
                  class="family-sub-table"
                >
                  <el-table-column prop="id" label="家庭ID" width="80" />
                  <el-table-column prop="name" label="家庭名称" min-width="110" />
                  <el-table-column prop="address" label="家庭地址" min-width="180" show-overflow-tooltip />
                  <el-table-column label="家属" min-width="120">
                    <template #default="{ row }">
                      {{ row.guardians?.map((g: any) => g.name).join('、') || '暂无' }}
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="caregiver-no-family">暂无管辖家庭（在「医护绑定」中为该护工绑定家庭）</div>
              </div>
            </template>
            <el-empty v-else description="暂无医护人员，点击「添加医护」分配" :image-size="40" />
          </div>
        </div>
      </template>
    </el-card>

    <!-- 新增/编辑机构 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑机构' : '新增机构'" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="机构名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="医疗机构" value="MEDICAL_INSTITUTION" />
            <el-option label="社区管理" value="COMMUNITY" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域"><el-input v-model="form.region" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveOrg">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建机构管理员（小程序 INSTITUTION 角色） -->
    <el-dialog v-model="userDialogVisible" title="添加机构管理员" width="440px">
      <el-alert
        title="此账号用于小程序机构管理端登录，可查看预约并派单"
        type="info" :closable="false" show-icon style="margin-bottom:16px"
      />
      <el-form :model="userForm" label-width="90px">
        <el-form-item label="姓名"><el-input v-model="userForm.name" placeholder="管理员真实姓名" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="userForm.phone" placeholder="11位手机号（登录账号）" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="userForm.password" type="password" show-password placeholder="至少6位" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAdmin">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分配医护人员到机构 -->
    <el-dialog v-model="assignCaregiverVisible" title="添加医护人员到机构" width="460px">
      <el-alert
        title="从未分配机构的护工中选择，分配后护工可在小程序查看本机构的预约"
        type="info" :closable="false" show-icon style="margin-bottom:16px"
      />
      <el-form label-width="90px">
        <el-form-item label="选择护工" required>
          <el-select
            v-model="assignForm.caregiverId"
            placeholder="请选择护工"
            style="width:100%"
            filterable
          >
            <el-option
              v-for="u in unassignedCaregivers()"
              :key="u.id"
              :label="`${u.name}（${u.mobile}）`"
              :value="u.id"
            />
          </el-select>
          <div style="font-size:12px;color:#909399;margin-top:4px">
            仅显示尚未分配机构的医护人员。若列表为空，请先在「用户管理」中创建护工账号。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignCaregiverVisible = false">取消</el-button>
        <el-button type="primary" :loading="assignLoading" @click="submitAssignCaregiver">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.staff-detail-panel {
  margin: 16px 0;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
}

.staff-detail-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.staff-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.staff-section {
  margin-bottom: 20px;
}

.staff-section:last-child { margin-bottom: 0; }

.staff-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.staff-count { font-size: 13px; color: #6b7280; }

.sub-table { border-radius: 6px; overflow: hidden; }

/* 护工卡片 */
.caregiver-row {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 10px;
}

.caregiver-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.caregiver-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.caregiver-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.caregiver-mobile {
  font-size: 13px;
  color: #6b7280;
}

.family-sub-table {
  border-radius: 6px;
  overflow: hidden;
}

.caregiver-no-family {
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 4px;
  font-style: italic;
}
</style>
