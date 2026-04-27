# Dashboard Alarm Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add queued household alarm popups and a persistent red glow to the dashboard map until each alarm is marked handled or ignored.

**Architecture:** Extend `DashboardView.vue` with a local alarm session state that loads historical unhandled alarms on entry, appends newly discovered unhandled alarms during polling, and renders a custom overlay plus dialog for one alarm at a time. Reuse the existing `/alarms` and device list APIs, with light client-side enrichment for target name and address.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Element Plus messaging, Axios API wrappers, Day.js.

---

### Task 1: Add dashboard alarm queue state

**Files:**
- Modify: `demo_ui/src/views/DashboardView.vue`

- [ ] Define queue-oriented alarm view types and reactive state near the top of `DashboardView.vue`.

```ts
interface DashboardAlarmItem {
  id: number
  deviceId: string
  targetId: number
  alarmType: string
  alarmLevel: string
  alarmTime: string
  handleStatus: string
  targetName: string
  address: string
}

const alarmQueue = ref<DashboardAlarmItem[]>([])
const activeAlarm = ref<DashboardAlarmItem | null>(null)
const alarmOverlayVisible = ref(false)
const selectedAlarmResult = ref<'HANDLED' | 'IGNORED' | ''>('')
const seenAlarmIds = ref<number[]>([])
```

- [ ] Add helpers to normalize, sort, and deduplicate unhandled alarms.

```ts
function sortAlarmQueue(list: DashboardAlarmItem[]) {
  return [...list].sort((a, b) => dayjs(a.alarmTime).valueOf() - dayjs(b.alarmTime).valueOf())
}

function nextSeenIds(ids: number[], append: number[]) {
  return [...new Set([...ids, ...append])]
}
```

- [ ] Run type check for the file before adding behavior.

Run: `npm run build`

Expected: build may still pass with no behavioral changes; if unrelated warnings exist, capture them before continuing.

### Task 2: Load historical unhandled alarms and append newly discovered alarms

**Files:**
- Modify: `demo_ui/src/views/DashboardView.vue`

- [ ] Split alarm fetching into a reusable loader that requests a wide enough historical range and keeps only `UNHANDLED` alarms.

```ts
async function fetchUnhandledDashboardAlarms() {
  const userId = authStore.userInfo?.userId
  const role = authStore.userInfo?.role
  const alarms = await alarmApi.list({
    guardianId: role === 'ADMIN' ? undefined : userId,
    startTime: dayjs().subtract(365, 'day').toISOString(),
    endTime: dayjs().toISOString(),
  }).catch(() => [])

  return alarms.filter((item) => item.handleStatus === 'UNHANDLED')
}
```

- [ ] Enrich alarms with device-derived labels and addresses.

```ts
function toDashboardAlarmItem(alarm: Alarm, devices: Device[]): DashboardAlarmItem {
  const device = devices.find((item) => item.deviceId === alarm.deviceId)
  return {
    ...alarm,
    targetName: device?.targetName || `监护对象 ${alarm.targetId}`,
    address: device?.address || '未配置家庭地址',
  }
}
```

- [ ] Queue historical alarms during initial load and append only unseen alarms during silent refresh.

```ts
function enqueueDashboardAlarms(items: DashboardAlarmItem[]) {
  const unseen = items.filter((item) => !seenAlarmIds.value.includes(item.id))
  if (!unseen.length) return
  alarmQueue.value = sortAlarmQueue([...alarmQueue.value, ...unseen])
  seenAlarmIds.value = nextSeenIds(seenAlarmIds.value, unseen.map((item) => item.id))
  if (!activeAlarm.value) openNextDashboardAlarm()
}
```

- [ ] Replace the current summary-only alarm refresh path so summary counts still update while queue state stays consistent.

Run: `npm run build`

Expected: PASS

### Task 3: Render the red glow and serial popup flow

**Files:**
- Modify: `demo_ui/src/views/DashboardView.vue`

- [ ] Add open/close helpers that drive one alarm at a time.

```ts
function openNextDashboardAlarm() {
  activeAlarm.value = alarmQueue.value.shift() || null
  alarmOverlayVisible.value = !!activeAlarm.value
  selectedAlarmResult.value = ''
}

function clearDashboardAlarm() {
  activeAlarm.value = null
  alarmOverlayVisible.value = false
  selectedAlarmResult.value = ''
}
```

- [ ] Add a custom overlay block in the template for the red glow and dialog.

```vue
<div v-if="alarmOverlayVisible" class="alarm-red-glow" />
<div v-if="activeAlarm" class="alarm-dialog-wrap">
  <div class="alarm-dialog-card">
    <div class="alarm-dialog-title">家庭报警提醒</div>
    <div class="alarm-dialog-row"><span>报警类型</span><strong>{{ activeAlarm.alarmType }}</strong></div>
    <div class="alarm-dialog-row"><span>成员</span><strong>{{ activeAlarm.targetName }}</strong></div>
    <div class="alarm-dialog-row"><span>地址</span><strong>{{ activeAlarm.address }}</strong></div>
    <div class="alarm-dialog-row"><span>时间</span><strong>{{ dayjs(activeAlarm.alarmTime).format('YYYY-MM-DD HH:mm:ss') }}</strong></div>
  </div>
</div>
```

- [ ] Add scoped styles for the glow, dialog, result selector, and disabled close state.

```css
.alarm-red-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(239, 68, 68, 0.26), rgba(239, 68, 68, 0.08) 42%, rgba(239, 68, 68, 0) 72%);
  animation: dashboard-alarm-glow 1.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 8;
}
```

- [ ] Run the frontend build after markup and style changes.

Run: `npm run build`

Expected: PASS

### Task 4: Submit handled or ignored result on close

**Files:**
- Modify: `demo_ui/src/views/DashboardView.vue`

- [ ] Add the result selector and close action.

```ts
async function submitDashboardAlarm() {
  if (!activeAlarm.value || !selectedAlarmResult.value) return
  await alarmApi.handle({
    alarmId: activeAlarm.value.id,
    handleStatus: selectedAlarmResult.value,
    handlerId: authStore.userInfo?.userId ?? 0,
    handleRemark: selectedAlarmResult.value === 'HANDLED' ? '首页地图弹窗已处理' : '首页地图弹窗已忽略',
  })
  clearDashboardAlarm()
  await refreshAlarmSummarySilently()
  openNextDashboardAlarm()
}
```

- [ ] Surface request failures without dropping the current alarm.

```ts
catch (error) {
  ElMessage.error('报警处理失败，请重试')
}
```

- [ ] Verify the build again.

Run: `npm run build`

Expected: PASS

### Task 5: Manual verification and commit

**Files:**
- Modify: none

- [ ] Start the local dashboard and verify the queue manually with seeded unhandled alarms.

Run: `npm run dev`

Expected: dashboard loads, historical unhandled alarms appear one by one, red glow stays active until each alarm is closed with a result.

- [ ] Commit the dashboard changes.

```bash
git add src/views/DashboardView.vue docs/superpowers/plans/2026-04-27-dashboard-alarm-overlay.md
git commit -m "feat: add dashboard alarm overlay queue"
```
