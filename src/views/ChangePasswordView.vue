<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

async function submit() {
  if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
    ElMessage.warning('请完整填写密码信息')
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  loading.value = true
  try {
    await authApi.changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
    authStore.updateUserInfo({
      ...(authStore.userInfo ?? {}),
      userId: authStore.userInfo?.userId ?? 0,
      role: authStore.userInfo?.role ?? 'GUARDIAN',
      forcePasswordChange: false,
    })
    ElMessage.success('密码修改成功')
    await router.push('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="password-page">
    <el-card class="password-card">
      <template #header>
        <div>
          <div class="title">修改初始密码</div>
          <div class="subtitle">首次登录必须先修改密码后才能继续使用后台</div>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="原密码">
          <el-input v-model="form.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="form.confirmPassword" type="password" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">保存新密码</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(160deg, #f4f8ff 0%, #edf2f7 100%);
}

.password-card {
  width: 100%;
  max-width: 480px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #102542;
}

.subtitle {
  margin-top: 8px;
  color: #5b7083;
  font-size: 14px;
}

.submit-btn {
  width: 100%;
}
</style>
