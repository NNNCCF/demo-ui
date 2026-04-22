<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, alarmApi, organizationApi } from '@/api/modules'
import { roleLabelMap } from '@/constants/dicts'
import type { AlarmLevel, AlarmType, UserRole } from '@/types'


const resetPasswordVisible = ref(false)
const resetPasswordForm = reactive({ userId: 0, username: '', newPassword: '' })

interface UserRow {
  userId: number
  username: string
  role: UserRole
  region?: string
  phone?: string
  status: 'ENABLED' | 'DISABLED'
}


const users = ref<UserRow[]>([])

const addUserVisible = ref(false)
const userForm = reactive({
  username: '',
  password: '',
  role: 'GUARDIAN' as UserRole,
  region: '',
  phone: '',
  orgId: null as number | null,
})

type AlarmRuleMap = Record<AlarmType, {
  id: number
  alarmType: AlarmType
  minValue?: number
  maxValue?: number
  continuousTimes?: number
  offlineMinutes?: number
  alarmLevel: AlarmLevel
}>

const alarmRules = ref<Partial<AlarmRuleMap>>({})

const ruleForm = reactive({
  alarmType: 'HEART_RATE' as AlarmType,
  minValue: 40,
  maxValue: 120,
  continuousTimes: 3,
  offlineMinutes: 30,
  alarmLevel: 'EMERGENCY' as AlarmLevel,
})

// show/hide logic per rule type
const showMinMax = computed(() => ruleForm.alarmType === 'HEART_RATE' || ruleForm.alarmType === 'BREATH_RATE')
const showContinuousTimes = computed(() => ruleForm.alarmType === 'HEART_RATE' || ruleForm.alarmType === 'BREATH_RATE')
const showOfflineMinutes = computed(() => ruleForm.alarmType === 'DEVICE_OFFLINE')

async function loadRules() {
  try {
    alarmRules.value = await alarmApi.getRules()
    applyRuleToForm(ruleForm.alarmType)
  } catch {
    // ignore if not available
  }
}

function applyRuleToForm(type: AlarmType) {
  const rule = alarmRules.value[type]
  if (!rule) return
  ruleForm.minValue = rule.minValue ?? ruleForm.minValue
  ruleForm.maxValue = rule.maxValue ?? ruleForm.maxValue
  ruleForm.continuousTimes = rule.continuousTimes ?? ruleForm.continuousTimes
  ruleForm.offlineMinutes = rule.offlineMinutes ?? ruleForm.offlineMinutes
  ruleForm.alarmLevel = rule.alarmLevel ?? ruleForm.alarmLevel
}

watch(() => ruleForm.alarmType, (type) => {
  applyRuleToForm(type)
})

const paramsForm = reactive({
  dataRetentionDays: 30,
  notifyRetryTimes: 3,
  rateLimitPerMinute: 100,
  defaultMapRegion: '110000',
})

const logs = ref<{ id: number; deviceId?: string; commandBody: string; sentAt: string; responseStatus?: string }[]>([])


async function saveUser() {
  if (!userForm.username.trim()) {
    ElMessage.error('请输入用户名')
    return
  }
  if (userForm.password.length < 6) {
    ElMessage.error('初始密码至少 6 位')
    return
  }
  await adminApi.createUser({
    username: userForm.username.trim(),
    password: userForm.password,
    role: userForm.role,
    region: userForm.region.trim() || undefined,
    phone: userForm.phone.trim() || undefined,
    orgId: userForm.orgId || undefined,
  })
  addUserVisible.value = false
  userForm.username = ''
  userForm.password = ''
  userForm.role = 'GUARDIAN'
  userForm.region = ''
  userForm.phone = ''
  userForm.orgId = null
  await loadUsers()
  ElMessage.success('新增用户成功')
}

async function toggleUserStatus(row: UserRow) {
  const nextStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  await adminApi.updateUserStatus({ userId: row.userId, status: nextStatus })
  await loadUsers()
}

async function saveRule() {
  await alarmApi.updateRule(ruleForm)
  await loadRules()
  ElMessage.success('告警规则已保存')
}

async function loadParams() {
  try {
    const config = await adminApi.systemConfig()
    if (config.dataRetentionDays) paramsForm.dataRetentionDays = Number(config.dataRetentionDays)
    if (config.notifyRetryTimes) paramsForm.notifyRetryTimes = Number(config.notifyRetryTimes)
    if (config.rateLimitPerMinute) paramsForm.rateLimitPerMinute = Number(config.rateLimitPerMinute)
    if (config.defaultMapRegion) paramsForm.defaultMapRegion = config.defaultMapRegion
  } catch {
    // 保持默认值
  }
}

async function saveParams() {
  await adminApi.saveSystemConfig({
    dataRetentionDays: String(paramsForm.dataRetentionDays),
    notifyRetryTimes: String(paramsForm.notifyRetryTimes),
    rateLimitPerMinute: String(paramsForm.rateLimitPerMinute),
    defaultMapRegion: paramsForm.defaultMapRegion,
  })
  ElMessage.success('系统参数已保存')
}


function openResetPassword(row: UserRow) {
  resetPasswordForm.userId = row.userId
  resetPasswordForm.username = row.username
  resetPasswordForm.newPassword = ''
  resetPasswordVisible.value = true
}

async function submitResetPassword() {
  if (resetPasswordForm.newPassword.length < 6) {
    ElMessage.warning('新密码不能少于6位')
    return
  }
  await ElMessageBox.confirm(`确认重置用户 "${resetPasswordForm.username}" 的密码？`, '提示', { type: 'warning' })
  await adminApi.resetPassword(resetPasswordForm.userId, resetPasswordForm.newPassword)
  resetPasswordVisible.value = false
  ElMessage.success('密码已重置')
}

async function loadLogs() {
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const end = new Date().toISOString()
  const commandLogs = await adminApi.commandLogs(start, end).catch(() => [])
  logs.value = commandLogs
}

async function loadUsers() {
  users.value = await adminApi.users().catch(() => [])
}

function roleText(value: UserRole) {
  return roleLabelMap[value]
}


void loadUsers()
void loadLogs()
void loadRules()
void loadParams()

// --- 服务器状态 ---
const serverStatus = ref<any>(null)
const serverStatusLoading = ref(false)

async function loadServerStatus() {
  if (!serverStatus.value) serverStatusLoading.value = true
  try {
    serverStatus.value = await adminApi.systemStatus()
  } catch {
    ElMessage.error('获取服务器状态失败')
  } finally {
    serverStatusLoading.value = false
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}时`)
  parts.push(`${m}分`)
  return parts.join('')
}

let statusTimer: ReturnType<typeof setInterval> | null = null

const orgList = ref<{ id: number; name: string }[]>([])
async function loadOrgList() {
  orgList.value = await organizationApi.list().catch(() => [])
}

onMounted(() => {
  loadServerStatus()
  statusTimer = setInterval(loadServerStatus, 1000)
  loadUsers()
  loadOrgList()
})

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<template>
  <div>
    <!-- 服务器状态 -->
    <el-card class="page-card">
      <template #header>
        <div class="head">
          <span>服务器状态</span>
          <el-button size="small" :loading="serverStatusLoading" @click="loadServerStatus">刷新</el-button>
        </div>
      </template>
      <div v-if="serverStatus" v-loading="serverStatusLoading">
        <!-- 各服务健康状态 -->
        <div style="margin-bottom: 16px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #606266;">依赖服务</div>
          <el-space wrap>
            <template v-for="(svc, name) in serverStatus.services" :key="name">
              <el-tag
                :type="svc.status === 'UP' ? 'success' : 'danger'"
                size="large"
                style="font-size: 13px;"
              >
                {{ name }}: {{ svc.status }}
              </el-tag>
            </template>
          </el-space>
        </div>

        <el-divider />

        <!-- JVM 内存 + 系统资源 -->
        <el-row :gutter="32">
          <el-col :span="12">
            <div style="font-weight: 600; margin-bottom: 12px; color: #606266;">JVM 内存</div>
            <div style="margin-bottom: 6px; font-size: 13px; color: #909399;">
              堆内存：{{ serverStatus.jvm.heapUsedMB }} MB / {{ serverStatus.jvm.heapMaxMB }} MB
            </div>
            <el-progress
              :percentage="serverStatus.jvm.heapUsedPct"
              :color="serverStatus.jvm.heapUsedPct > 85 ? '#f56c6c' : serverStatus.jvm.heapUsedPct > 65 ? '#e6a23c' : '#67c23a'"
              :format="(p: number) => p.toFixed(1) + '%'"
            />
            <div style="margin-top: 12px; font-size: 13px; color: #909399;">
              活跃线程：{{ serverStatus.jvm.liveThreads }} 个
            </div>
          </el-col>
          <el-col :span="12">
            <div style="font-weight: 600; margin-bottom: 12px; color: #606266;">系统资源</div>
            <div style="margin-bottom: 6px; font-size: 13px; color: #909399;">
              CPU 使用率
            </div>
            <el-progress
              :percentage="serverStatus.system.cpuUsagePct"
              :color="serverStatus.system.cpuUsagePct > 85 ? '#f56c6c' : serverStatus.system.cpuUsagePct > 65 ? '#e6a23c' : '#67c23a'"
              :format="(p: number) => p.toFixed(1) + '%'"
            />
            <div style="margin-top: 12px; margin-bottom: 6px; font-size: 13px; color: #909399;">
              磁盘使用率（剩余 {{ serverStatus.system.diskFreeMB >= 1024 ? (serverStatus.system.diskFreeMB / 1024).toFixed(1) + ' GB' : serverStatus.system.diskFreeMB + ' MB' }}）
            </div>
            <el-progress
              :percentage="serverStatus.system.diskUsedPct"
              :color="serverStatus.system.diskUsedPct > 90 ? '#f56c6c' : serverStatus.system.diskUsedPct > 75 ? '#e6a23c' : '#67c23a'"
              :format="(p: number) => p.toFixed(1) + '%'"
            />
          </el-col>
        </el-row>

        <el-divider />

        <!-- 运行时信息 -->
        <div style="font-weight: 600; margin-bottom: 8px; color: #606266;">运行时信息</div>
        <el-descriptions :column="3" size="small" border>
          <el-descriptions-item label="Java 版本">{{ serverStatus.runtime.javaVersion }}</el-descriptions-item>
          <el-descriptions-item label="启动时间">{{ serverStatus.runtime.startTime ? new Date(serverStatus.runtime.startTime).toLocaleString() : '-' }}</el-descriptions-item>
          <el-descriptions-item label="已运行">{{ formatUptime(serverStatus.runtime.uptimeSeconds) }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <el-empty v-else-if="!serverStatusLoading" description="暂无数据" />
      <div v-else v-loading="true" style="height: 80px;" />
    </el-card>

    <el-card class="page-card" style="margin-top: 16px;">
      <template #header>
        <div class="head">
          <span>用户管理</span>
          <el-button type="primary" @click="addUserVisible = true">新增用户</el-button>
        </div>
      </template>
      <el-table :data="users" border>
        <el-table-column prop="userId" label="用户ID" width="120" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column label="角色">
          <template #default="{ row }">{{ roleText(row.role as UserRole) }}</template>
        </el-table-column>
        <el-table-column prop="region" label="所属区域" />
        <el-table-column prop="phone" label="联系方式" />
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'">
              {{ row.status === 'ENABLED' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link @click="toggleUserStatus(row)">
              {{ row.status === 'ENABLED' ? '禁用' : '启用' }}
            </el-button>
            <el-button link @click="openResetPassword(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="grid-2" style="margin-top: 16px">
      <el-card class="page-card">
        <template #header>告警规则配置</template>
        <el-form :model="ruleForm" label-width="130px">
          <el-form-item label="规则类型">
            <el-select v-model="ruleForm.alarmType" style="width: 100%">
              <el-option label="心率异常" value="HEART_RATE" />
              <el-option label="呼吸率异常" value="BREATH_RATE" />
              <el-option label="跌倒警告" value="FALL" />
              <el-option label="设备离线" value="DEVICE_OFFLINE" />
            </el-select>
          </el-form-item>
          <template v-if="showMinMax">
            <el-form-item>
              <template #label>
                <span>{{ ruleForm.alarmType === 'HEART_RATE' ? '心率最小值(次/分)' : '呼吸率最小值(次/分)' }}</span>
              </template>
              <el-input-number v-model="ruleForm.minValue" :min="1" style="width: 100%" />
            </el-form-item>
            <el-form-item>
              <template #label>
                <span>{{ ruleForm.alarmType === 'HEART_RATE' ? '心率最大值(次/分)' : '呼吸率最大值(次/分)' }}</span>
              </template>
              <el-input-number v-model="ruleForm.maxValue" :min="1" style="width: 100%" />
            </el-form-item>
          </template>
          <el-form-item v-if="showContinuousTimes" label="连续异常次数">
            <el-input-number v-model="ruleForm.continuousTimes" :min="1" :max="10" style="width: 100%" />
            <div class="form-tip">连续检测到该次数后才触发告警</div>
          </el-form-item>
          <el-form-item v-if="showOfflineMinutes" label="离线触发时长(分)">
            <el-input-number v-model="ruleForm.offlineMinutes" :min="1" style="width: 100%" />
          </el-form-item>
          <el-form-item v-if="ruleForm.alarmType === 'FALL'" label="跌倒检测说明">
            <el-alert type="info" :closable="false" show-icon>
              <template #default>跌倒事件检测到即立即触发告警，无需配置阈值</template>
            </el-alert>
          </el-form-item>
          <el-form-item label="告警级别">
            <el-select v-model="ruleForm.alarmLevel" style="width: 100%">
              <el-option label="紧急" value="EMERGENCY" />
              <el-option label="一般" value="NORMAL" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="saveRule">保存规则</el-button>
        </el-form>
      </el-card>

      <el-card class="page-card">
        <template #header>系统参数配置</template>
        <el-form :model="paramsForm" label-width="160px">
          <el-form-item label="数据保留时长(天)">
            <el-input-number v-model="paramsForm.dataRetentionDays" :min="1" />
          </el-form-item>
          <el-form-item label="告警通知重试次数">
            <el-input-number v-model="paramsForm.notifyRetryTimes" :min="0" />
          </el-form-item>
          <el-form-item label="接口限流阈值">
            <el-input-number v-model="paramsForm.rateLimitPerMinute" :min="1" />
          </el-form-item>
          <el-form-item label="地图默认区域">
            <el-input v-model="paramsForm.defaultMapRegion" />
          </el-form-item>
          <el-button type="primary" @click="saveParams">保存配置</el-button>
        </el-form>
      </el-card>
    </div>

    <el-card class="page-card" style="margin-top: 16px">
      <template #header>系统日志</template>
      <el-table :data="logs" border>
        <el-table-column prop="deviceId" label="设备号" min-width="150" />
        <el-table-column prop="commandBody" label="内容" min-width="220" />
        <el-table-column prop="sentAt" label="时间" min-width="180" />
      </el-table>
    </el-card>

  </div>

  <el-dialog v-model="resetPasswordVisible" title="重置密码" width="420px">
    <el-form :model="resetPasswordForm" label-width="100px">
      <el-form-item label="用户名">
        <el-input :value="resetPasswordForm.username" disabled />
      </el-form-item>
      <el-form-item label="新密码" required>
        <el-input v-model="resetPasswordForm.newPassword" type="password" show-password placeholder="不少于6位" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="resetPasswordVisible = false">取消</el-button>
      <el-button type="primary" @click="submitResetPassword">确认重置</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="addUserVisible" title="新增用户" width="500px">
    <el-form :model="userForm" label-width="100px">
      <el-alert
        title="新建账号后将强制首次登录修改密码，首个 ADMIN 账号由系统初始化提供。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-form-item label="用户名">
        <el-input v-model="userForm.username" />
      </el-form-item>
      <el-form-item label="初始密码">
        <el-input v-model="userForm.password" type="password" />
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="userForm.role" style="width: 100%">
          <el-option label="超级管理员" value="ADMIN" />
          <el-option label="普通操作员" value="GUARDIAN" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属区域">
        <el-input v-model="userForm.region" />
      </el-form-item>
      <el-form-item label="联系方式">
        <el-input v-model="userForm.phone" />
      </el-form-item>
      <el-form-item label="所属机构" v-if="userForm.role === 'GUARDIAN'">
        <el-select v-model="userForm.orgId" placeholder="请选择机构（可选）" clearable style="width: 100%">
          <el-option v-for="o in orgList" :key="o.id" :label="o.name" :value="o.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="addUserVisible = false">取消</el-button>
      <el-button type="primary" @click="saveUser">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

</style>
