<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Link, User, Phone } from '@element-plus/icons-vue'
import { clientUserApi, deviceApi } from '@/api/modules'
import type { ClientUser, Device } from '@/types'

const loading = ref(false)
const tableData = ref<ClientUser[]>([])
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const bindDialogVisible = ref(false)
const currentUserId = ref<number | null>(null)
const availableDevices = ref<Device[]>([])
const selectedDeviceId = ref('')

const formRef = ref()
const form = reactive({
  id: 0,
  mobile: '',
  name: '',
  password: '',
  role: 'GUARDIAN',
  gender: 'MALE' as 'MALE' | 'FEMALE',
  birthday: '',
  height: undefined as number | undefined,
  weight: undefined as number | undefined,
  wardRole: '',
  chronicDisease: '',
  remark: ''
})

const rules = {
  mobile: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (form.role === 'WARD') {
          callback()
          return
        }
        if (!value) {
          callback(new Error('请输入手机号'))
          return
        }
        if (!/^1[3-9]\d{9}$/.test(value)) {
          callback(new Error('手机号格式不正确'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ],
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  password: [
    { required: false, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ],
  gender: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ]
}

const roleMap: Record<string, string> = {
  GUARDIAN: '监护人',
  WARD: '被监护人',
  CAREGIVER: '护工'
}

const getRoleTagType = (role: string) => {
  switch (role) {
    case 'GUARDIAN': return 'primary'
    case 'WARD': return 'warning'
    case 'CAREGIVER': return 'success'
    default: return 'info'
  }
}

const isWardRole = computed(() => form.role === 'WARD')
const isWardRow = (row: ClientUser) => row.sourceType === 'WARD' || row.role === 'WARD'
const clientUserRowKey = (row: ClientUser) => `${row.sourceType || 'CLIENT_USER'}:${row.id}`

const fetchData = async () => {
  loading.value = true
  try {
    const res = await clientUserApi.list()
    tableData.value = res || []
  } catch (error) {
    console.error('Failed to fetch client users:', error)
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  dialogType.value = 'add'
  form.id = 0
  form.mobile = ''
  form.name = ''
  form.password = ''
  form.role = 'GUARDIAN'
  form.gender = 'MALE'
  form.birthday = ''
  form.height = undefined
  form.weight = undefined
  form.wardRole = ''
  form.chronicDisease = ''
  form.remark = ''
  dialogVisible.value = true
}

const handleEdit = (row: ClientUser) => {
  dialogType.value = 'edit'
  form.id = row.id
  form.mobile = row.mobile || ''
  form.name = row.name
  form.password = ''
  form.role = row.role
  form.gender = row.gender || 'MALE'
  form.birthday = row.birthday || ''
  form.height = row.height
  form.weight = row.weight
  form.wardRole = row.wardRole || ''
  form.chronicDisease = row.chronicDisease || ''
  form.remark = row.remark || ''
  dialogVisible.value = true
}

const handleDelete = async (row: ClientUser) => {
  try {
    await ElMessageBox.confirm('确定要删除该用户吗？', '提示', {
      type: 'warning'
    })
    await clientUserApi.delete(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        if (dialogType.value === 'add') {
          if (form.role === 'WARD') {
            await clientUserApi.create({
              mobile: form.mobile,
              name: form.name,
              role: form.role,
              gender: form.gender,
              birthday: form.birthday || undefined,
              height: form.height,
              weight: form.weight,
              wardRole: form.wardRole || undefined,
              chronicDisease: form.chronicDisease || undefined,
              remark: form.remark || undefined
            })
          } else {
            if (!form.password) {
              ElMessage.warning('新增用户必须设置密码')
              return
            }
            await clientUserApi.create({
              mobile: form.mobile,
              name: form.name,
              password: form.password,
              role: form.role
            })
          }
          ElMessage.success('添加成功')
        } else {
          if (form.role === 'WARD') {
            await clientUserApi.update(form.id, {
              mobile: form.mobile,
              name: form.name,
              role: form.role,
              gender: form.gender,
              birthday: form.birthday || undefined,
              height: form.height,
              weight: form.weight,
              wardRole: form.wardRole || undefined,
              chronicDisease: form.chronicDisease || undefined,
              remark: form.remark || undefined
            })
          } else {
            await clientUserApi.update(form.id, {
              mobile: form.mobile,
              name: form.name,
              password: form.password || undefined,
              role: form.role
            })
          }
          ElMessage.success('更新成功')
        }
        dialogVisible.value = false
        fetchData()
      } catch (error) {
        console.error(error)
      }
    }
  })
}

const handleBind = async (row: ClientUser) => {
  if (isWardRow(row)) {
    ElMessage.warning('被监护人不在 client_user 中，不支持此处绑定')
    return
  }
  currentUserId.value = row.id
  selectedDeviceId.value = ''
  bindDialogVisible.value = true

  try {
    const res = await deviceApi.list()
    availableDevices.value = res || []
  } catch (error) {
    console.error(error)
  }
}

const submitBind = async () => {
  if (!currentUserId.value || !selectedDeviceId.value) {
    ElMessage.warning('请选择设备')
    return
  }
  
  try {
    await clientUserApi.bindDevice(currentUserId.value, selectedDeviceId.value)
    ElMessage.success('绑定成功')
    bindDialogVisible.value = false
    fetchData()
  } catch (error) {
    console.error(error)
  }
}

const handleUnbind = async (userId: number, deviceId: string) => {
  try {
    await ElMessageBox.confirm(`确定要解绑设备 ${deviceId} 吗？`, '提示', {
      type: 'warning'
    })
    await clientUserApi.unbindDevice(userId, deviceId)
    ElMessage.success('解绑成功')
    fetchData()
  } catch (error) {
    if (error !== 'cancel') console.error(error)
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">用户管理</span>
      <el-button type="primary" :icon="Plus" @click="handleAdd">添加用户</el-button>
    </div>

    <el-card class="page-card">
    <el-table v-loading="loading" :data="tableData" :row-key="clientUserRowKey" style="width: 100%" border>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="name" label="姓名" min-width="120">
        <template #default="{ row }">
          <div class="user-info">
            <el-icon><User /></el-icon>
            <span style="margin-left: 8px">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="mobile" label="手机号" min-width="140">
        <template #default="{ row }">
          <div class="user-info">
            <el-icon><Phone /></el-icon>
            <span style="margin-left: 8px">{{ row.mobile || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="getRoleTagType(row.role)">{{ roleMap[row.role] || row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="被监护人信息" min-width="220">
        <template #default="{ row }">
          <span v-if="isWardRow(row)">
            {{ row.gender === 'MALE' ? '男' : row.gender === 'FEMALE' ? '女' : '-' }}
            <span v-if="row.birthday"> | {{ new Date(row.birthday).toLocaleDateString() }}</span>
            <span v-if="row.wardRole"> | {{ row.wardRole }}</span>
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="绑定设备" min-width="200">
        <template #default="{ row }">
          <div class="device-tags">
            <el-tag 
              v-for="device in row.devices" 
              :key="device.deviceId" 
              class="device-tag"
              :closable="!isWardRow(row)"
              @close="handleUnbind(row.id, device.deviceId)"
            >
              {{ device.deviceId }}
            </el-tag>
            <el-button v-if="!isWardRow(row)" link type="primary" size="small" :icon="Link" @click="handleBind(row)">绑定</el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="180">
        <template #default="{ row }">
          {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '添加用户' : '编辑用户'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="95px">
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" placeholder="请选择角色" style="width: 100%" :disabled="dialogType === 'edit'">
            <el-option label="监护人" value="GUARDIAN" />
            <el-option label="被监护人" value="WARD" />
            <el-option label="护工" value="CAREGIVER" />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="form.mobile" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item v-if="!isWardRole" label="密码" prop="password">
          <el-input 
            v-model="form.password" 
            type="password" 
            show-password 
            :placeholder="dialogType === 'add' ? '请输入密码' : '不修改请留空'" 
          />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="性别" prop="gender">
          <el-select v-model="form.gender" style="width: 100%">
            <el-option label="男" value="MALE" />
            <el-option label="女" value="FEMALE" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isWardRole" label="生日">
          <el-date-picker v-model="form.birthday" type="date" placeholder="选择生日" value-format="YYYY-MM-DDTHH:mm:ss[Z]" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="身高(cm)">
          <el-input-number v-model="form.height" :min="0" :max="300" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="体重(kg)">
          <el-input-number v-model="form.weight" :min="0" :max="500" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="关系角色">
          <el-input v-model="form.wardRole" placeholder="如：父亲、母亲" />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="慢病史">
          <el-input v-model="form.chronicDisease" placeholder="请输入慢病信息" />
        </el-form-item>
        <el-form-item v-if="isWardRole" label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>

    </el-card>

    <!-- Bind Device Dialog -->
    <el-dialog v-model="bindDialogVisible" title="绑定设备" width="400px">
      <el-form label-width="80px">
        <el-form-item label="选择设备">
          <el-select v-model="selectedDeviceId" placeholder="请选择设备" filterable style="width: 100%">
            <el-option
              v-for="device in availableDevices"
              :key="device.deviceId"
              :label="`${device.deviceId} (${device.deviceType})`"
              :value="device.deviceId"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="bindDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitBind">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.user-info {
  display: flex;
  align-items: center;
}
.device-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.device-tag {
  margin-right: 0;
}
</style>
