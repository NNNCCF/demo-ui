<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { authApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types'
import loginImage from '@/image/login-image.png'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const loginError = ref('')
const registerVisible = ref(false)
const registerRef = ref<FormInstance>()
const registerLoading = ref(false)

const form = reactive({
  username: '',
  role: 'ADMIN' as UserRole,
  password: '',
  captchaInput: '',
  remember: true,
})

const registerForm = reactive({
  username: '',
  password: '',
  role: 'GUARDIAN' as UserRole,
  region: '',
  phone: '',
})

const captchaId = ref('')
const captchaUrl = ref('')

async function refreshCaptcha() {
  try {
    const res = await authApi.captcha()
    if (res.code === 200 && res.data) {
      captchaId.value = res.data.id
      captchaUrl.value = res.data.url
    } else {
      ElMessage.error(res.msg || '获取验证码失败')
    }
  } catch (error) {
    ElMessage.error('获取验证码失败')
  }
}

onMounted(() => {
  refreshCaptcha()
})

const rules: FormRules = {
  username: [{ required: true, message: t('login.userIdRule'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRule'), trigger: 'blur' }],
  captchaInput: [
    {
      required: true,
      message: t('login.captchaError'),
      trigger: 'blur',
    },
  ],
}

const registerRules: FormRules = {
  username: [{ required: true, message: t('login.usernameRule'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRule'), trigger: 'blur' }],
}

async function submit() {
  loginError.value = ''
  await formRef.value?.validate(async (valid) => {
    if (!valid) {
      return
    }
    loading.value = true
    try {
      const verifyRes = await authApi.verifyCaptcha(captchaId.value, form.captchaInput)
      if (verifyRes.code !== 1 && verifyRes.code !== 200) {
        ElMessage.error(verifyRes.msg || '验证码错误')
        refreshCaptcha()
        form.captchaInput = ''
        loading.value = false
        return
      }
      
      const response = await authApi.login({ username: form.username, role: form.role, password: form.password })
      authStore.setAuth(response.token, { userId: response.userId, role: response.role, username: response.username, orgId: response.orgId, orgType: response.orgType })
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '登录失败'
      loginError.value = message
      refreshCaptcha()
      form.captchaInput = ''
    } finally {
      loading.value = false
    }
  })
}

async function submitRegister() {
  await registerRef.value?.validate(async (valid) => {
    if (!valid) {
      return
    }
    registerLoading.value = true
    try {
      const res = await authApi.register({
        username: registerForm.username,
        password: registerForm.password,
        role: registerForm.role,
        region: registerForm.region,
        phone: registerForm.phone,
      })
      registerVisible.value = false
      
      // Auto fill login form
      if (res.username) {
        form.username = res.username
        ElMessageBox.alert(`注册成功！您的登录用户名是：${res.username}`, '注册成功', {
          confirmButtonText: '去登录',
          callback: () => {
             // focused
          }
        })
      } else {
        ElMessage.success(t('login.registerSuccess'))
      }

      form.role = registerForm.role
      form.password = registerForm.password
      form.captchaInput = ''
      refreshCaptcha()
      registerForm.username = ''
      registerForm.password = ''
      registerForm.role = 'GUARDIAN'
      registerForm.region = ''
      registerForm.phone = ''
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '注册失败'
      ElMessage.error(message)
    } finally {
      registerLoading.value = false
    }
  })
}
</script>

<template>
  <div class="login-page">
    <div
      class="login-left"
      :style="{
        backgroundImage: `url(${loginImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }"
    >
    </div>
    <div class="login-right">
      <div class="form-container">
        <div class="form-header">
          <h2>欢迎登录</h2>
          <p class="subtitle">卓凯安伴综合管理平台</p>
        </div>
        <el-form ref="formRef" :model="form" :rules="rules" class="login-form">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" class="custom-input" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              show-password
              type="password"
              placeholder="请输入密码"
              class="custom-input"
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-form-item prop="captchaInput">
            <div class="captcha-row">
              <el-input
                v-model="form.captchaInput"
                placeholder="请输入验证码"
                class="custom-input captcha-input"
                @keyup.enter="submit"
              />
              <div class="captcha-img" @click="refreshCaptcha">
                <img v-if="captchaUrl" :src="captchaUrl" alt="captcha" />
                <span v-else>加载中...</span>
              </div>
            </div>
          </el-form-item>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <el-checkbox v-model="form.remember">记住我</el-checkbox>
            <el-button link type="primary" @click="registerVisible = true">注册账号</el-button>
          </div>

          <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
            登录
          </el-button>
          <div v-if="loginError" class="error">{{ loginError }}</div>
        </el-form>
      </div>
    </div>
  </div>

  <!-- Register Dialog -->
  <el-dialog v-model="registerVisible" :title="t('login.registerTitle')" width="520px">
    <el-form ref="registerRef" :model="registerForm" :rules="registerRules" label-position="top">
      <el-form-item :label="t('login.username')" prop="username">
        <el-input v-model="registerForm.username" />
      </el-form-item>
      <el-form-item :label="t('login.password')" prop="password">
        <el-input v-model="registerForm.password" show-password type="password" />
      </el-form-item>
      <el-form-item :label="t('login.role')" prop="role">
        <el-select v-model="registerForm.role" style="width: 100%">
          <el-option :label="t('login.admin')" value="ADMIN" />
          <el-option :label="t('login.guardian')" value="GUARDIAN" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('login.region')" prop="region">
        <el-input v-model="registerForm.region" />
      </el-form-item>
      <el-form-item :label="t('login.phone')" prop="phone">
        <el-input v-model="registerForm.phone" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="registerVisible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="registerLoading" @click="submitRegister">
        {{ t('login.registerSubmit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.login-left {
  flex: 1;
  background-color: #f0f9ff; /* Fallback color */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.login-right {
  flex: 0 0 500px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-container {
  width: 100%;
  max-width: 360px;
  padding: 40px;
}

.form-header {
  margin-bottom: 40px;
  text-align: left;
}

.form-header h2 {
  font-size: 32px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.custom-input :deep(.el-input__wrapper) {
  background-color: #f8fafc;
  box-shadow: none !important;
  border-radius: 8px;
  padding: 8px 16px;
  height: 48px;
}

.custom-input :deep(.el-input__inner) {
  height: 48px;
}

.custom-input :deep(.el-input__wrapper:hover),
.custom-input :deep(.el-input__wrapper.is-focus) {
  background-color: #f1f5f9;
}

.submit-btn {
  width: 100%;
  height: 48px;
  border-radius: 8px;
  font-size: 16px;
  margin-top: 16px;
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.submit-btn:hover {
  background-color: #1e40af;
  border-color: #1e40af;
}

.captcha-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.captcha-input {
  flex: 1;
}

.captcha-img {
  width: 150px;
  height: 50px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.captcha-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.error {
  margin-top: 16px;
  color: #ef4444;
  text-align: center;
  font-size: 14px;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .login-page {
    flex-direction: column;
  }
  
  .login-left {
    display: none;
  }
  
  .login-right {
    flex: 1;
    width: 100%;
  }
}
</style>
