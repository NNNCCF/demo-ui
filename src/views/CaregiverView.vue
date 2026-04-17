<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { clientUserApi, familyApi } from '@/api/modules'
import type { ClientUser } from '@/types'

const loading = ref(false)
const caregivers = ref<ClientUser[]>([])
const allFamilies = ref<any[]>([])

// 展开状态：caregiverId → 是否展开
const expandedIds = ref<Set<number>>(new Set())

// 绑定家庭弹窗
const bindFamilyVisible = ref(false)
const currentCaregiver = ref<ClientUser | null>(null)
const selectedFamilyId = ref<number | null>(null)
const bindingFamily = ref(false)

// 家庭详情抽屉
const detailVisible = ref(false)
const detailLoading = ref(false)
const familyDetail = ref<any>(null)

async function loadData() {
  loading.value = true
  try {
    const [users, fList] = await Promise.all([
      clientUserApi.list(),
      familyApi.list(),
    ])
    caregivers.value = (users as any[]).filter((u: any) => u.role === 'CAREGIVER')
    allFamilies.value = fList as any[]
  } finally {
    loading.value = false
  }
}

/** 获取护工管辖的家庭列表（orgId 匹配） */
function getCaregiverFamilies(caregiver: ClientUser) {
  if (!caregiver.orgId) return []
  return allFamilies.value.filter((f: any) => f.orgId === caregiver.orgId)
}

/** 尚未绑定到该护工机构的家庭（供绑定时选择） */
function getUnboundFamilies(caregiver: ClientUser | null) {
  if (!caregiver) return allFamilies.value
  if (!caregiver.orgId) return allFamilies.value.filter((f: any) => !f.orgId)
  return allFamilies.value.filter((f: any) => !f.orgId || f.orgId !== caregiver.orgId)
}

function toggleExpand(id: number) {
  const s = new Set(expandedIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expandedIds.value = s
}

function openBindFamily(caregiver: ClientUser) {
  currentCaregiver.value = caregiver
  selectedFamilyId.value = null
  bindFamilyVisible.value = true
}

async function submitBindFamily() {
  if (!currentCaregiver.value || !selectedFamilyId.value) {
    ElMessage.warning('请选择要绑定的家庭')
    return
  }
  if (!currentCaregiver.value.orgId) {
    ElMessage.error('该护工未关联医疗机构，请先在机构管理中为其分配机构')
    return
  }
  bindingFamily.value = true
  try {
    await familyApi.bindCaregiver(selectedFamilyId.value, currentCaregiver.value.id)
    ElMessage.success('绑定成功，家庭已归属到该护工所在机构')
    bindFamilyVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e.message || '绑定失败')
  } finally {
    bindingFamily.value = false
  }
}

async function openFamilyDetail(familyId: number) {
  detailVisible.value = true
  detailLoading.value = true
  familyDetail.value = null
  try {
    familyDetail.value = await familyApi.detail(familyId)
  } catch (e: any) {
    ElMessage.error(e.message || '加载详情失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function genderLabel(g: string) {
  return g === 'MALE' ? '男' : g === 'FEMALE' ? '女' : '-'
}

function deviceStatusLabel(s: string) {
  return s === 'ONLINE' ? '在线' : s === 'OFFLINE' ? '离线' : '未知'
}

function deviceStatusType(s: string) {
  return s === 'ONLINE' ? 'success' : s === 'OFFLINE' ? 'info' : 'warning'
}

async function unbindDevice(user: ClientUser, deviceId: string) {
  await ElMessageBox.confirm(`确认解绑设备 ${deviceId}？`, '提示', { type: 'warning' })
  await clientUserApi.unbindDevice(user.id, deviceId)
  ElMessage.success('已解绑')
  await loadData()
}

async function deleteCaregiver(user: ClientUser) {
  await ElMessageBox.confirm(`确认删除护理人员 "${user.name}"？`, '提示', { type: 'warning' })
  await clientUserApi.delete(user.id)
  ElMessage.success('已删除')
  caregivers.value = caregivers.value.filter((c) => c.id !== user.id)
}

onMounted(loadData)
</script>

<template>
  <el-card class="page-card">
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>医护绑定</span>
        <el-text type="info" size="small">管理护理人员与家庭的绑定关系</el-text>
      </div>
    </template>

    <el-table v-loading="loading" :data="caregivers" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="姓名" min-width="100" />
      <el-table-column prop="mobile" label="手机号" min-width="130" />
      <el-table-column label="所属机构ID" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.orgId" type="success" size="small">{{ row.orgId }}</el-tag>
          <el-text v-else type="danger" size="small">未分配机构</el-text>
        </template>
      </el-table-column>
      <el-table-column label="管辖家庭数" width="100">
        <template #default="{ row }">
          <el-tag type="primary" size="small">{{ getCaregiverFamilies(row).length }} 户</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="绑定设备" min-width="180">
        <template #default="{ row }">
          <template v-if="row.devices?.length">
            <el-tag
              v-for="d in row.devices"
              :key="d.deviceId"
              closable
              style="margin:2px"
              @close="unbindDevice(row, d.deviceId)"
            >{{ d.deviceId }}</el-tag>
          </template>
          <el-text v-else type="info">未绑定</el-text>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openBindFamily(row)">绑定家庭</el-button>
          <el-button link type="info" @click="toggleExpand(row.id)">
            {{ expandedIds.has(row.id) ? '收起' : '查看家庭' }}
          </el-button>
          <el-button link type="danger" @click="deleteCaregiver(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 展开的管辖家庭列表 -->
    <template v-for="caregiver in caregivers" :key="'fam-' + caregiver.id">
      <div v-if="expandedIds.has(caregiver.id)" class="family-panel">
        <div class="family-panel-header">
          <span class="family-panel-title">「{{ caregiver.name }}」管辖家庭</span>
          <el-text type="info" size="small">机构ID: {{ caregiver.orgId || '未分配' }}</el-text>
        </div>

        <el-table
          v-if="getCaregiverFamilies(caregiver).length > 0"
          :data="getCaregiverFamilies(caregiver)"
          border
          size="small"
          class="sub-table"
        >
          <el-table-column prop="id" label="家庭ID" width="80" />
          <el-table-column prop="name" label="家庭名称" min-width="120" />
          <el-table-column prop="address" label="家庭地址" min-width="180" show-overflow-tooltip />
          <el-table-column label="家属" min-width="140">
            <template #default="{ row }">
              <span v-if="row.guardians?.length">
                {{ row.guardians.map((g: any) => g.name).join('、') }}
              </span>
              <el-text v-else type="info">暂无</el-text>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openFamilyDetail(row.id)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-else description="该护工暂无管辖家庭，点击「绑定家庭」添加" :image-size="48" />
      </div>
    </template>

    <el-empty v-if="!loading && caregivers.length === 0" description="暂无护理人员" />
  </el-card>

  <!-- 绑定家庭弹窗 -->
  <el-dialog v-model="bindFamilyVisible" title="绑定家庭到护工" width="480px">
    <el-alert
      title="绑定后，家庭归属到护工所在医疗机构，家属端将显示该护工为「家庭医生」"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom:16px"
    />
    <el-form label-width="90px">
      <el-form-item label="护工">
        <el-input :value="currentCaregiver?.name" disabled />
      </el-form-item>
      <el-form-item label="所属机构">
        <el-input
          :value="currentCaregiver?.orgId ? `机构ID：${currentCaregiver.orgId}` : '未关联机构（请先在机构管理中分配）'"
          disabled
        />
      </el-form-item>
      <el-form-item label="选择家庭" required>
        <el-select v-model="selectedFamilyId" placeholder="请选择家庭" style="width:100%" filterable>
          <el-option
            v-for="f in getUnboundFamilies(currentCaregiver)"
            :key="f.id"
            :label="`${f.name}${f.address ? ' · ' + f.address : ''}`"
            :value="f.id"
          />
        </el-select>
        <div style="font-size:12px;color:#909399;margin-top:4px">仅显示尚未归属到该机构的家庭</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="bindFamilyVisible = false">取消</el-button>
      <el-button type="primary" :loading="bindingFamily" @click="submitBindFamily">确认绑定</el-button>
    </template>
  </el-dialog>

  <!-- 家庭详情抽屉 -->
  <el-drawer v-model="detailVisible" title="家庭详情" size="520px" direction="rtl">
    <div v-loading="detailLoading">
      <template v-if="familyDetail">

        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="detail-section-title">🏠 基本信息</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="家庭名称">{{ familyDetail.name }}</el-descriptions-item>
            <el-descriptions-item label="家庭地址">{{ familyDetail.address || '未填写' }}</el-descriptions-item>
            <el-descriptions-item label="归属机构ID">
              <el-tag v-if="familyDetail.orgId" type="success" size="small">{{ familyDetail.orgId }}</el-tag>
              <el-text v-else type="warning">未归属机构</el-text>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ familyDetail.createdAt ? new Date(familyDetail.createdAt).toLocaleString('zh-CN') : '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 家属信息 -->
        <div class="detail-section">
          <div class="detail-section-title">👤 家属（监护人）</div>
          <template v-if="familyDetail.guardians?.length">
            <el-descriptions
              v-for="g in familyDetail.guardians"
              :key="g.id"
              :column="2"
              border
              size="small"
              class="detail-item-desc"
            >
              <el-descriptions-item label="姓名">{{ g.name }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ g.mobile || '-' }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <el-empty v-else description="暂无家属信息" :image-size="40" />
        </div>

        <!-- 被监护人 -->
        <div class="detail-section">
          <div class="detail-section-title">🧓 被监护人</div>
          <template v-if="familyDetail.wards?.length">
            <el-card
              v-for="w in familyDetail.wards"
              :key="w.memberId"
              class="ward-card"
              shadow="never"
            >
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="姓名">{{ w.name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="性别">{{ genderLabel(w.gender) }}</el-descriptions-item>
                <el-descriptions-item label="出生日期">{{ w.birthday || '-' }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ w.mobile || '-' }}</el-descriptions-item>
                <el-descriptions-item label="慢性病史" :span="2">{{ w.chronicDisease || '无' }}</el-descriptions-item>
                <el-descriptions-item label="紧急联系" :span="2">{{ w.emergencyPhone || '-' }}</el-descriptions-item>
                <el-descriptions-item label="备注" :span="2">{{ w.remark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="绑定设备" :span="2">
                  <el-tag size="small">{{ w.deviceId }}</el-tag>
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </template>
          <el-empty v-else description="暂无被监护人信息" :image-size="40" />
        </div>

        <!-- 设备信息 -->
        <div class="detail-section">
          <div class="detail-section-title">📡 监护设备</div>
          <template v-if="familyDetail.devices?.length">
            <el-card
              v-for="d in familyDetail.devices"
              :key="d.deviceId"
              class="device-card"
              shadow="never"
            >
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="设备编号" :span="2">
                  <el-tag type="primary" size="small">{{ d.deviceId }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="设备状态">
                  <el-tag :type="deviceStatusType(d.status)" size="small">{{ deviceStatusLabel(d.status) }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="绑定时间">{{ d.bindTime ? new Date(d.bindTime).toLocaleString('zh-CN') : '-' }}</el-descriptions-item>
                <el-descriptions-item label="安装地址" :span="2">{{ d.address || '-' }}</el-descriptions-item>
                <el-descriptions-item label="居家位置" :span="2">{{ d.homeLocation || '-' }}</el-descriptions-item>
                <el-descriptions-item label="GPS坐标" :span="2">
                  {{ d.latitude && d.longitude ? `${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)}` : '未定位' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </template>
          <el-empty v-else description="暂无设备信息" :image-size="40" />
        </div>

      </template>
      <el-empty v-else-if="!detailLoading" description="加载失败" />
    </div>
  </el-drawer>
</template>

<style scoped>
.family-panel {
  margin: 12px 0;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px 20px;
}

.family-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.family-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.sub-table {
  border-radius: 6px;
  overflow: hidden;
}

/* 详情抽屉 */
.detail-section {
  margin-bottom: 24px;
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid #3b82f6;
}

.detail-item-desc {
  margin-bottom: 8px;
}

.ward-card,
.device-card {
  margin-bottom: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.ward-card :deep(.el-card__body),
.device-card :deep(.el-card__body) {
  padding: 12px;
}
</style>
