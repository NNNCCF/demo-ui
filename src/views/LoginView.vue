<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'
import loginImage from '@/image/login-image.png'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const registerVisible = ref(false)
const registerLoading = ref(false)
const loginError = ref('')

const loginForm = reactive({
  username: '',
  password: '',
  captchaCode: '',
})

const registerForm = reactive({
  username: '',
  password: '',
  region: '',
  phone: '',
  captchaCode: '',
})

const loginCaptchaToken = ref('')
const loginCaptchaUrl = ref('')
const loginCooldownSeconds = ref(0)

const registerCaptchaToken = ref('')
const registerCaptchaUrl = ref('')
const registerCooldownSeconds = ref(0)

let countdownTimer: number | null = null

function parseCooldownSeconds(message: string) {
  const match = message.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function ensureCountdown() {
  if (countdownTimer !== null) {
    return
  }
  countdownTimer = window.setInterval(() => {
    if (loginCooldownSeconds.value > 0) {
      loginCooldownSeconds.value -= 1
      if (loginCooldownSeconds.value === 0) {
        void loadLoginCaptcha()
      }
    }
    if (registerCooldownSeconds.value > 0) {
      registerCooldownSeconds.value -= 1
      if (registerCooldownSeconds.value === 0 && registerVisible.value) {
        void loadRegisterCaptcha()
      }
    }
  }, 1000)
}

async function loadLoginCaptcha() {
  const response = await authApi.getCaptcha('LOGIN')
  loginCaptchaToken.value = response.captchaToken
  loginCaptchaUrl.value = response.imageUrl
  loginCooldownSeconds.value = response.cooldownSeconds
}

async function loadRegisterCaptcha() {
  const response = await authApi.getCaptcha('REGISTER')
  registerCaptchaToken.value = response.captchaToken
  registerCaptchaUrl.value = response.imageUrl
  registerCooldownSeconds.value = response.cooldownSeconds
}

function resetRegisterForm() {
  registerForm.username = ''
  registerForm.password = ''
  registerForm.region = ''
  registerForm.phone = ''
  registerForm.captchaCode = ''
}

async function submitLogin() {
  if (!loginForm.username || !loginForm.password || !loginForm.captchaCode) {
    ElMessage.warning('请完整填写登录信息')
    return
  }
  if (loginCooldownSeconds.value > 0) {
    ElMessage.warning(`请 ${loginCooldownSeconds.value} 秒后重试`)
    return
  }
  loading.value = true
  loginError.value = ''
  try {
    const response = await authApi.login({
      username: loginForm.username,
      password: loginForm.password,
      captchaToken: loginCaptchaToken.value,
      captchaCode: loginForm.captchaCode,
    })
    authStore.setAuth(response.token, {
      userId: response.userId,
      username: response.username,
      role: response.role,
      orgId: response.orgId,
      orgType: response.orgType,
      forcePasswordChange: response.forcePasswordChange,
    })
    ElMessage.success('登录成功')
    loginForm.captchaCode = ''
    await loadLoginCaptcha()
    await router.push(response.forcePasswordChange ? '/change-password' : '/dashboard')
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败'
    loginError.value = message
    const cooldown = parseCooldownSeconds(message)
    if (cooldown > 0) {
      loginCooldownSeconds.value = cooldown
      loginCaptchaToken.value = ''
      loginCaptchaUrl.value = ''
    }
    loginForm.captchaCode = ''
    await loadLoginCaptcha()
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  if (!registerForm.username || !registerForm.password || !registerForm.captchaCode) {
    ElMessage.warning('请完整填写注册信息')
    return
  }
  if (registerCooldownSeconds.value > 0) {
    ElMessage.warning(`请 ${registerCooldownSeconds.value} 秒后重试`)
    return
  }
  registerLoading.value = true
  try {
    await authApi.register({
      username: registerForm.username,
      password: registerForm.password,
      region: registerForm.region || undefined,
      phone: registerForm.phone || undefined,
      captchaToken: registerCaptchaToken.value,
      captchaCode: registerForm.captchaCode,
    })
    ElMessage.success('注册成功，请登录')
    loginForm.username = registerForm.username
    loginForm.password = registerForm.password
    registerVisible.value = false
    resetRegisterForm()
    await loadLoginCaptcha()
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败'
    const cooldown = parseCooldownSeconds(message)
    if (cooldown > 0) {
      registerCooldownSeconds.value = cooldown
      registerCaptchaToken.value = ''
      registerCaptchaUrl.value = ''
    }
    registerForm.captchaCode = ''
    if (registerVisible.value) {
      await loadRegisterCaptcha()
    }
  } finally {
    registerLoading.value = false
  }
}

watch(registerVisible, async (visible) => {
  if (visible) {
    registerForm.captchaCode = ''
    await loadRegisterCaptcha()
  }
})

onMounted(async () => {
  ensureCountdown()
  await loadLoginCaptcha()
})

onBeforeUnmount(() => {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<template>
  <div class="login-page">
    <div class="login-left" :style="{ backgroundImage: `url(${loginImage})` }" />
    <div class="login-right">
      <div class="form-container">
        <div class="form-header">
          <h2>欢迎登录</h2>
          <p class="subtitle">卓凯安伴综合管理平台</p>
        </div>

        <el-form class="login-form" @submit.prevent="submitLogin">
          <el-form-item>
            <el-input v-model="loginForm.username" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="loginForm.password" type="password" show-password placeholder="请输入密码" @keyup.enter="submitLogin" />
          </el-form-item>
          <el-form-item>
            <div class="captcha-row">
              <el-input
                v-model="loginForm.captchaCode"
                placeholder="请输入验证码"
                :disabled="loginCooldownSeconds > 0"
                @keyup.enter="submitLogin"
              />
              <div class="captcha-img" @click="loginCooldownSeconds === 0 && loadLoginCaptcha()">
                <template v-if="loginCooldownSeconds > 0">
                  <span>{{ loginCooldownSeconds }} 秒后重试</span>
                </template>
                <img v-else-if="loginCaptchaUrl" :src="loginCaptchaUrl" alt="captcha" />
                <span v-else>加载中...</span>
              </div>
            </div>
          </el-form-item>

          <div class="action-row">
            <el-button link type="primary" @click="registerVisible = true">注册账号</el-button>
          </div>

          <el-button type="primary" class="submit-btn" :loading="loading" :disabled="loginCooldownSeconds > 0" @click="submitLogin">
            登录
          </el-button>
          <div v-if="loginError" class="error">{{ loginError }}</div>
        </el-form>
      </div>
    </div>
  </div>

  <el-dialog v-model="registerVisible" title="注册账号" width="520px">
    <el-form label-position="top">
      <el-form-item label="用户名">
        <el-input v-model="registerForm.username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="registerForm.password" type="password" show-password />
      </el-form-item>
      <el-form-item label="区域">
        <el-input v-model="registerForm.region" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="registerForm.phone" />
      </el-form-item>
      <el-form-item label="验证码">
        <div class="captcha-row">
          <el-input v-model="registerForm.captchaCode" :disabled="registerCooldownSeconds > 0" />
          <div class="captcha-img" @click="registerCooldownSeconds === 0 && loadRegisterCaptcha()">
            <template v-if="registerCooldownSeconds > 0">
              <span>{{ registerCooldownSeconds }} 秒后重试</span>
            </template>
            <img v-else-if="registerCaptchaUrl" :src="registerCaptchaUrl" alt="register-captcha" />
            <span v-else>加载中...</span>
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="registerVisible = false">取消</el-button>
      <el-button type="primary" :loading="registerLoading" :disabled="registerCooldownSeconds > 0" @click="submitRegister">
        注册
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
}

.login-left {
  flex: 1;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.login-right {
  width: 460px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: linear-gradient(180deg, #f7fbff 0%, #eef5ff 100%);
}

.form-container {
  width: 100%;
  max-width: 360px;
}

.form-header {
  margin-bottom: 24px;
}

.form-header h2 {
  margin: 0;
  font-size: 30px;
  color: #102542;
}

.subtitle {
  margin: 8px 0 0;
  color: #5b7083;
}

.captcha-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 132px;
  gap: 12px;
}

.captcha-img {
  min-height: 40px;
  border: 1px solid #d0d7e2;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  cursor: pointer;
  overflow: hidden;
  color: #4f6478;
  font-size: 12px;
  text-align: center;
  padding: 4px;
}

.captcha-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.submit-btn {
  width: 100%;
}

.error {
  margin-top: 12px;
  color: #d64545;
  font-size: 13px;
}

@media (max-width: 900px) {
  .login-left {
    display: none;
  }

  .login-right {
    width: 100%;
    min-height: 100vh;
  }
}
</style>
