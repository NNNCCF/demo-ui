<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { rolePermissionApi } from '@/api/modules'

const routeOptions = [
  '/dashboard', '/devices', '/alarms', '/caregiver', '/service-orders', '/users',
  '/feedbacks', '/news', '/families', '/organizations', '/property-managements',
  '/call-records', '/role-permissions', '/system',
]

const loading = ref(false)
const permissions = ref<Record<string, string[]>>({})

async function loadData() {
  loading.value = true
  try {
    permissions.value = await rolePermissionApi.get()
  } finally {
    loading.value = false
  }
}

async function saveRole(role: string) {
  permissions.value = await rolePermissionApi.update(role, permissions.value[role] || [])
  ElMessage.success(`${role} 权限已保存`)
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">角色权限管理</span>
      <el-button @click="loadData">刷新</el-button>
    </div>

    <el-card class="page-card">
      <el-table v-loading="loading" :data="Object.keys(permissions).map((role) => ({ role }))" border>
        <el-table-column prop="role" label="角色" width="140" />
        <el-table-column label="可见路由">
          <template #default="{ row }">
            <el-select v-model="permissions[row.role]" multiple filterable collapse-tags style="width: 100%">
              <el-option v-for="route in routeOptions" :key="route" :label="route" :value="route" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="saveRole(row.role)">保存</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
