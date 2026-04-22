<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { newsApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'
import type { NewsPost } from '@/types'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.userInfo?.role === 'ADMIN')

const loading = ref(false)
const submitting = ref(false)
const list = ref<NewsPost[]>([])
const currentPost = ref<NewsPost | null>(null)
const detailVisible = ref(false)
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editorRef = ref<HTMLDivElement>()

const visibilityOptions = [
  { label: '全部可见', value: 'ALL' },
  { label: '家属可见', value: 'GUARDIAN' },
  { label: '被监护人可见', value: 'WARD' },
]

const form = reactive({
  id: null as number | null,
  title: '',
  visibility: 'ALL',
  publisherName: authStore.userInfo?.username || '管理员',
  publishTime: '',
  attachments: [] as string[],
})

function parseAttachments(value: string | undefined) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return value ? [value] : []
  }
}

async function loadList() {
  loading.value = true
  try {
    list.value = await newsApi.list()
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.id = null
  form.title = ''
  form.visibility = 'ALL'
  form.publisherName = authStore.userInfo?.username || '管理员'
  form.publishTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
  form.attachments = []
}

function setEditorContent(content: string) {
  window.setTimeout(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = content
    }
  }, 0)
}

function openCreate() {
  resetForm()
  formMode.value = 'create'
  formVisible.value = true
  setEditorContent('')
}

async function openEdit(row: NewsPost) {
  const detail = await newsApi.getById(row.id).catch(() => row)
  currentPost.value = detail
  form.id = detail.id
  form.title = detail.title
  form.visibility = detail.visibility || 'ALL'
  form.publisherName = detail.publisherName || authStore.userInfo?.username || '管理员'
  form.publishTime = detail.publishTime ? dayjs(detail.publishTime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss')
  form.attachments = parseAttachments(detail.attachments)
  formMode.value = 'edit'
  formVisible.value = true
  setEditorContent(detail.content || '')
}

async function openDetail(row: NewsPost) {
  currentPost.value = await newsApi.getById(row.id).catch(() => row)
  detailVisible.value = true
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
  editorRef.value?.focus()
}

function insertLink() {
  const url = window.prompt('请输入链接地址', 'https://') || ''
  if (url) execCmd('createLink', url)
}

function insertTable() {
  const html = '<table border="1" style="border-collapse:collapse;width:100%"><tr><td style="padding:6px">&nbsp;</td><td style="padding:6px">&nbsp;</td></tr><tr><td style="padding:6px">&nbsp;</td><td style="padding:6px">&nbsp;</td></tr></table><p><br></p>'
  document.execCommand('insertHTML', false, html)
  editorRef.value?.focus()
}

function insertImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      document.execCommand('insertImage', false, event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function setFontColor(color: string) {
  document.execCommand('foreColor', false, color)
  editorRef.value?.focus()
}

function setHighlight(color: string) {
  document.execCommand('hiliteColor', false, color)
  editorRef.value?.focus()
}

function onAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  form.attachments = [...form.attachments, ...files.map((file) => file.name)]
  input.value = ''
}

function removeAttachment(index: number) {
  form.attachments.splice(index, 1)
}

async function submitPost() {
  const content = editorRef.value?.innerHTML || ''
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!content || content === '<br>' || content.trim() === '') {
    ElMessage.warning('请输入正文内容')
    return
  }

  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      content,
      visibility: form.visibility,
      publisherId: authStore.userInfo?.userId || 0,
      publisherName: form.publisherName,
      publishTime: dayjs(form.publishTime).toISOString(),
      attachments: form.attachments,
    }
    if (formMode.value === 'create') {
      await newsApi.create(payload)
      ElMessage.success('动态发布成功')
    } else if (form.id) {
      await newsApi.update(form.id, payload)
      ElMessage.success('动态更新成功')
    }
    formVisible.value = false
    await loadList()
  } finally {
    submitting.value = false
  }
}

async function deletePost(row: NewsPost) {
  await ElMessageBox.confirm(`确认删除动态《${row.title}》吗？`, '提示', { type: 'warning' })
  await newsApi.delete(row.id)
  ElMessage.success('动态已删除')
  detailVisible.value = false
  await loadList()
}

function visibilityLabel(value: string) {
  return visibilityOptions.find((item) => item.value === value)?.label || value
}

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="page-wrap">
    <div class="page-header">
      <span class="page-title">动态发布</span>
      <div class="header-actions">
        <el-button @click="loadList">刷新</el-button>
        <el-button v-if="isAdmin" type="primary" @click="openCreate">发布动态</el-button>
      </div>
    </div>

    <el-card class="page-card">
      <el-table v-loading="loading" :data="list" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
        <el-table-column label="可见范围" width="130">
          <template #default="{ row }">{{ visibilityLabel(row.visibility) }}</template>
        </el-table-column>
        <el-table-column prop="publisherName" label="发布人" width="140" />
        <el-table-column label="发布时间" width="180">
          <template #default="{ row }">{{ dayjs(row.publishTime).format('YYYY-MM-DD HH:mm') }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">{{ row.updatedAt ? dayjs(row.updatedAt).format('YYYY-MM-DD HH:mm') : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-row">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <template v-if="isAdmin">
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link type="danger" @click="deletePost(row)">删除</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" title="动态详情" size="720px">
      <template v-if="currentPost">
        <div class="detail-head">
          <h2>{{ currentPost.title }}</h2>
          <div class="detail-meta">
            <span>发布人：{{ currentPost.publisherName }}</span>
            <span>发布时间：{{ dayjs(currentPost.publishTime).format('YYYY-MM-DD HH:mm:ss') }}</span>
            <span>可见范围：{{ visibilityLabel(currentPost.visibility) }}</span>
          </div>
        </div>
        <div class="detail-content" v-html="currentPost.content" />
        <div v-if="parseAttachments(currentPost.attachments).length" class="attachment-block">
          <div class="attachment-title">附件</div>
          <div class="attachment-list">
            <el-tag v-for="item in parseAttachments(currentPost.attachments)" :key="item">{{ item }}</el-tag>
          </div>
        </div>
        <div v-if="isAdmin" class="detail-actions">
          <el-button @click="openEdit(currentPost)">编辑</el-button>
          <el-button type="danger" plain @click="deletePost(currentPost)">删除</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '发布动态' : '编辑动态'"
      width="920px"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="可见范围">
              <el-select v-model="form.visibility" style="width: 100%">
                <el-option v-for="item in visibilityOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="发布人">
              <el-input v-model="form.publisherName" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="发布时间">
              <el-date-picker
                v-model="form.publishTime"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="正文内容" required>
          <div class="editor-wrapper">
            <div class="editor-toolbar">
              <button type="button" @click.prevent="execCmd('undo')">撤销</button>
              <button type="button" @click.prevent="execCmd('redo')">重做</button>
              <span class="toolbar-sep" />
              <button type="button" @click.prevent="execCmd('bold')">加粗</button>
              <button type="button" @click.prevent="execCmd('italic')">斜体</button>
              <button type="button" @click.prevent="execCmd('insertUnorderedList')">无序列表</button>
              <button type="button" @click.prevent="execCmd('insertOrderedList')">有序列表</button>
              <span class="toolbar-sep" />
              <button type="button" @click.prevent="insertTable">表格</button>
              <button type="button" @click.prevent="insertImage">图片</button>
              <button type="button" @click.prevent="insertLink">链接</button>
              <span class="toolbar-sep" />
              <label class="color-btn">
                字体色
                <input type="color" @input="(event) => setFontColor((event.target as HTMLInputElement).value)" />
              </label>
              <label class="color-btn">
                高亮
                <input type="color" @input="(event) => setHighlight((event.target as HTMLInputElement).value)" />
              </label>
            </div>
            <div
              ref="editorRef"
              contenteditable="true"
              class="editor-body"
              data-placeholder="请输入动态正文"
            />
          </div>
        </el-form-item>

        <el-form-item label="附件">
          <div class="attachment-form">
            <label class="attach-btn">
              <el-button>选择文件</el-button>
              <input type="file" multiple style="display: none" @change="onAttachmentChange" />
            </label>
            <div v-if="form.attachments.length" class="attachment-list">
              <el-tag
                v-for="(item, index) in form.attachments"
                :key="`${item}-${index}`"
                closable
                @close="removeAttachment(index)"
              >
                {{ item }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPost">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 12px;
}

.action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-head h2 {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.detail-meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #64748b;
  font-size: 13px;
}

.detail-content {
  margin-top: 24px;
  line-height: 1.8;
  color: #334155;
}

.attachment-block {
  margin-top: 24px;
}

.attachment-title {
  margin-bottom: 10px;
  font-weight: 600;
  color: #0f172a;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.editor-wrapper {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #dcdfe6;
}

.editor-toolbar button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: #dbe3ef;
}

.color-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 28px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: #334155;
}

.color-btn input[type='color'] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.editor-body {
  min-height: 220px;
  padding: 14px 16px;
  outline: none;
  font-size: 14px;
  line-height: 1.8;
}

.editor-body:empty::before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
}

.attachment-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
</style>
