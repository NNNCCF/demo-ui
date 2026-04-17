<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { newsApi } from '@/api/modules'
import { useAuthStore } from '@/stores/auth'
import type { NewsPost } from '@/types'

const authStore = useAuthStore()
const loading = ref(false)
const list = ref<NewsPost[]>([])
const createVisible = ref(false)
const submitting = ref(false)
const editorRef = ref<HTMLDivElement>()

const form = reactive({
  title: '',
  visibility: 'ALL',
  publisherName: authStore.userInfo?.username || '管理员',
  publishTime: new Date(),
  attachments: [] as File[],
})

const visibilityOptions = [
  { label: '全部', value: 'ALL' },
  { label: '监护人', value: 'GUARDIAN' },
  { label: '被监护人', value: 'WARD' },
]

async function loadList() {
  loading.value = true
  try {
    list.value = await newsApi.list()
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.title = ''
  form.visibility = 'ALL'
  form.publisherName = authStore.userInfo?.username || '管理员'
  form.publishTime = new Date()
  form.attachments = []
  createVisible.value = true
  setTimeout(() => {
    if (editorRef.value) editorRef.value.innerHTML = ''
  }, 100)
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
  const html = `<table border="1" style="border-collapse:collapse;width:100%"><tr><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td></tr><tr><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td></tr></table><p><br></p>`
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
    reader.onload = (e) => {
      document.execCommand('insertImage', false, e.target?.result as string)
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
  if (input.files) {
    form.attachments = [...form.attachments, ...Array.from(input.files)]
  }
}

function removeAttachment(index: number) {
  form.attachments.splice(index, 1)
}

async function submitPost() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  const content = editorRef.value?.innerHTML || ''
  if (!content || content === '<br>' || content.trim() === '') {
    ElMessage.warning('请输入内容')
    return
  }
  submitting.value = true
  try {
    await newsApi.create({
      title: form.title,
      content,
      visibility: form.visibility,
      publisherId: authStore.userInfo?.userId || 0,
      publisherName: form.publisherName,
      publishTime: dayjs(form.publishTime).toISOString(),
      attachments: form.attachments.map((f) => f.name),
    })
    ElMessage.success('发布成功')
    createVisible.value = false
    await loadList()
  } finally {
    submitting.value = false
  }
}

async function deletePost(id: number) {
  await ElMessageBox.confirm('确认删除该动态？', '提示', { type: 'warning' })
  await newsApi.delete(id)
  ElMessage.success('已删除')
  list.value = list.value.filter((p) => p.id !== id)
}

function visibilityLabel(v: string) {
  return visibilityOptions.find((o) => o.value === v)?.label || v
}

onMounted(loadList)
</script>

<template>
  <el-card class="page-card">
    <div class="page-toolbar">
      <span style="font-size:16px;font-weight:600">动态发布</span>
      <el-button type="primary" @click="openCreate">发布</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
      <el-table-column label="可见范围" width="110">
        <template #default="{ row }">{{ visibilityLabel(row.visibility) }}</template>
      </el-table-column>
      <el-table-column prop="publisherName" label="发布人" width="120" />
      <el-table-column label="发布时间" width="180">
        <template #default="{ row }">{{ dayjs(row.publishTime).format('YYYY-MM-DD HH:mm') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="deletePost(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && list.length === 0" description="暂无动态，点击右上角发布" />
  </el-card>

  <!-- Create Dialog -->
  <el-dialog
    v-model="createVisible"
    title=""
    width="860px"
    :show-close="false"
    class="news-dialog"
    destroy-on-close
  >
    <template #header>
      <div class="dialog-breadcrumb">
        <span class="breadcrumb-parent">动态发布</span>
        <span class="breadcrumb-sep"> &gt; </span>
        <span class="breadcrumb-current">发布</span>
      </div>
    </template>

    <el-tabs type="card" class="news-tabs">
      <el-tab-pane label="基本信息">
        <el-form label-width="90px" class="news-form">
          <el-form-item label="标题" required>
            <el-input v-model="form.title" placeholder="请输入" />
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="可见范围">
                <el-select v-model="form.visibility" style="width:100%">
                  <el-option v-for="o in visibilityOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="发布人">
                <el-input :value="form.publisherName" readonly />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="发布时间">
                <el-date-picker
                  v-model="form.publishTime"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm"
                  style="width:100%"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="内容" required>
            <div class="editor-wrapper">
              <!-- Toolbar -->
              <div class="editor-toolbar">
                <button title="撤销" @click.prevent="execCmd('undo')">&#8617;</button>
                <button title="重做" @click.prevent="execCmd('redo')">&#8618;</button>
                <span class="toolbar-sep" />
                <select title="段落样式" @change="(e) => execCmd('formatBlock', (e.target as HTMLSelectElement).value)">
                  <option value="p">段落</option>
                  <option value="h1">标题1</option>
                  <option value="h2">标题2</option>
                  <option value="h3">标题3</option>
                  <option value="blockquote">引用</option>
                </select>
                <span class="toolbar-sep" />
                <button title="加粗" @click.prevent="execCmd('bold')"><b>B</b></button>
                <button title="斜体" @click.prevent="execCmd('italic')"><i>I</i></button>
                <span class="toolbar-sep" />
                <button title="左对齐" @click.prevent="execCmd('justifyLeft')">&#8676;</button>
                <button title="居中" @click.prevent="execCmd('justifyCenter')">&#8801;</button>
                <button title="右对齐" @click.prevent="execCmd('justifyRight')">&#8677;</button>
                <button title="两端对齐" @click.prevent="execCmd('justifyFull')">&#9644;</button>
                <span class="toolbar-sep" />
                <button title="减少缩进" @click.prevent="execCmd('outdent')">&#8676;&#9144;</button>
                <button title="增加缩进" @click.prevent="execCmd('indent')">&#9144;&#8677;</button>
                <span class="toolbar-sep" />
                <button title="插入表格" @click.prevent="insertTable">&#9707;</button>
                <button title="插入图片" @click.prevent="insertImage">&#128247;</button>
                <button title="插入链接" @click.prevent="insertLink">&#128279;</button>
                <span class="toolbar-sep" />
                <label class="color-btn" title="字体颜色">
                  A
                  <input type="color" @input="(e) => setFontColor((e.target as HTMLInputElement).value)" />
                </label>
                <label class="color-btn" title="高亮颜色" style="background:#ff0;padding:0 4px;">
                  A
                  <input type="color" @input="(e) => setHighlight((e.target as HTMLInputElement).value)" />
                </label>
                <span class="toolbar-sep" />
                <button title="无序列表" @click.prevent="execCmd('insertUnorderedList')">&#8226;&#8212;</button>
                <button title="有序列表" @click.prevent="execCmd('insertOrderedList')">1&#8212;</button>
                <span class="toolbar-sep" />
                <button title="清除格式" @click.prevent="execCmd('removeFormat')"><i style="text-decoration:line-through">T</i></button>
              </div>
              <!-- Editor area -->
              <div
                ref="editorRef"
                contenteditable="true"
                class="editor-body"
                data-placeholder="请输入内容..."
              />
            </div>
          </el-form-item>

          <el-form-item label="附件">
            <div class="attachment-area">
              <label class="attach-btn">
                <el-button>选择文件</el-button>
                <input type="file" multiple style="display:none" @change="onAttachmentChange" />
              </label>
              <div v-if="form.attachments.length" class="attach-list">
                <el-tag
                  v-for="(f, i) in form.attachments"
                  :key="i"
                  closable
                  @close="removeAttachment(i)"
                  style="margin:4px 4px 0 0"
                >
                  {{ f.name }}
                </el-tag>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="createVisible = false">关闭</el-button>
      <el-button type="primary" :loading="submitting" @click="submitPost">发布</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dialog-breadcrumb {
  font-size: 15px;
}
.breadcrumb-parent {
  color: #409eff;
  cursor: default;
}
.breadcrumb-sep {
  color: #999;
  margin: 0 4px;
}
.breadcrumb-current {
  color: #333;
  font-weight: 500;
}

.news-tabs {
  margin-top: -8px;
}

.news-form {
  padding-top: 16px;
}

.editor-wrapper {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  user-select: none;
}

.editor-toolbar button,
.editor-toolbar select {
  height: 26px;
  padding: 0 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  line-height: 26px;
}

.editor-toolbar button:hover,
.editor-toolbar select:hover {
  background: #e6e8eb;
  border-color: #c0c4cc;
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: #dcdfe6;
  margin: 0 4px;
  align-self: center;
}

.color-btn {
  position: relative;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 26px;
  display: inline-flex;
  align-items: center;
}
.color-btn:hover {
  background: #e6e8eb;
  border-color: #c0c4cc;
}
.color-btn input[type='color'] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.editor-body {
  min-height: 160px;
  padding: 10px 12px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.editor-body:empty::before {
  content: attr(data-placeholder);
  color: #c0c4cc;
  pointer-events: none;
}

.attachment-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attach-list {
  display: flex;
  flex-wrap: wrap;
}
</style>
