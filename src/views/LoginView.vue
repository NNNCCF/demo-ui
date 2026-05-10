<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'
import loginImage from '@/image/login-image.png'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const loginError = ref('')

const loginForm = reactive({
  username: '',
  password: '',
  captchaCode: '',
})

const loginCaptchaToken = ref('')
const loginCaptchaUrl = ref('')
const loginCooldownSeconds = ref(0)

let countdownTimer: number | null = null

function parseCooldownSeconds(message: string) {
  const match = message.match(/retry in (\d+) seconds/i)
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
  }, 1000)
}

async function loadLoginCaptcha() {
  const response = await authApi.getCaptcha('LOGIN')
  loginCaptchaToken.value = response.captchaToken
  loginCaptchaUrl.value = response.imageUrl
  loginCooldownSeconds.value = response.cooldownSeconds
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
    <section class="login-visual" :style="{ backgroundImage: `url(${loginImage})` }" />

    <main class="login-right">
      <div class="form-container">
        <div class="form-header">
          <h2>欢迎登录</h2>
          <p class="subtitle">使用管理员账号进入卓凯安伴后台。</p>
        </div>

        <el-form class="login-form" @submit.prevent="submitLogin">
          <el-form-item label="账号">
            <el-input v-model="loginForm.username" size="large" placeholder="请输入用户名" clearable />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password"
              size="large"
              type="password"
              show-password
              placeholder="请输入密码"
              @keyup.enter="submitLogin"
            />
          </el-form-item>
          <el-form-item label="验证码">
            <div class="captcha-row">
              <el-input
                v-model="loginForm.captchaCode"
                size="large"
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

          <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :loading="loading"
            :disabled="loginCooldownSeconds > 0"
            @click="submitLogin"
          >
            登录
          </el-button>
          <div v-if="loginError" class="error">{{ loginError }}</div>
        </el-form>
      </div>
    </main>
  </div>

</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: #eef3f8;
}

.login-visual {
  flex: 1;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.login-right {
  width: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 248, 252, 0.96)),
    #f5f8fc;
}

.form-container {
  width: 100%;
  max-width: 392px;
  padding: 36px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 34, 67, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.form-header {
  margin-bottom: 28px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef5ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.form-header h2 {
  margin: 14px 0 0;
  font-size: 32px;
  color: #102033;
  letter-spacing: 0;
}

.subtitle {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.el-form-item__label) {
  color: #334155;
  font-weight: 600;
}

.login-form :deep(.el-input__wrapper) {
  min-height: 44px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #dbe4ef inset;
  background: #fbfdff;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 4px rgba(37, 99, 235, 0.10);
}

.captcha-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px;
  gap: 12px;
  align-items: center;
}

.captcha-row :deep(.el-input) {
  width: 100%;
}

.captcha-img {
  min-height: 44px;
  border: 1px solid #dbe4ef;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  cursor: pointer;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-align: center;
  padding: 4px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.captcha-img:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
}

.captcha-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.submit-btn {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  font-weight: 700;
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.22);
}

.error {
  margin-top: 12px;
  color: #dc2626;
  font-size: 13px;
  line-height: 1.6;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fef2f2;
}

@media (max-width: 900px) {
  .login-visual {
    display: none;
  }

  .login-right {
    width: 100%;
    min-height: 100vh;
    padding: 24px;
  }

  .form-container {
    max-width: 440px;
    padding: 28px;
  }
}
</style>
