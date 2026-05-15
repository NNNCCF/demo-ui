import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from '@/router'
import './style.css'
// TODO: i18n is configured (see src/locales/index.ts) but views use hardcoded Chinese.
// Wire up $t() calls across views before enabling, or remove vue-i18n to reduce bundle size.

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
