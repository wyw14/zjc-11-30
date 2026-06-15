<template>
  <div class="admin-panel">
    <div class="container">
      <header class="admin-header card">
        <div class="admin-header-inner">
          <div>
            <h1>🛠️ 故事管理中心</h1>
            <p class="admin-subtitle">管理所有社区微小说，支持重置故事内容与数据体检修复</p>
          </div>
          <div class="header-actions">
            <button class="btn-secondary" @click="loadStories">
              🔄 刷新列表
            </button>
            <button class="btn-primary" @click="runDiagnose">
              🔍 数据体检
            </button>
          </div>
        </div>
      </header>

      <section v-if="diagnoseResult" class="diagnose-panel card">
        <div class="diagnose-header">
          <div class="diagnose-title">
            <span class="diagnose-icon">📋</span>
            <h2>数据体检报告</h2>
            <span class="diagnose-time">{{ formatTime(diagnoseTime) }}</span>
          </div>
          <div class="diagnose-stats">
            <div class="stat-item">
              <span class="stat-label">故事总数</span>
              <span class="stat-value">{{ diagnoseResult.totalStories }}</span>
            </div>
            <div :class="['stat-item', diagnoseResult.issueCount > 0 ? 'stat-warn' : 'stat-ok']">
              <span class="stat-label">异常故事</span>
              <span class="stat-value">{{ diagnoseResult.issueCount }}</span>
            </div>
            <div :class="['stat-item', diagnoseResult.totalIssues > 0 ? 'stat-warn' : 'stat-ok']">
              <span class="stat-label">异常项数</span>
              <span class="stat-value">{{ diagnoseResult.totalIssues }}</span>
            </div>
          </div>
        </div>

        <div v-if="diagnoseResult.issueCount > 0" class="diagnose-actions">
          <button
            class="btn-danger"
            :disabled="fixingAll"
            @click="doFixAll"
          >
            {{ fixingAll ? '正在修复...' : `🔧 一键修复全部 (${diagnoseResult.issueCount}个)` }}
          </button>
          <span class="fix-hint">提示：修复操作会重新计算并修正段落顺序、字数统计和参与人数</span>
        </div>

        <div v-if="diagnoseResult.issueCount === 0" class="all-good">
          <span class="good-icon">✅</span>
          <p>所有故事数据状态良好，未发现异常！</p>
        </div>

        <div v-else class="diagnose-list">
          <div
            v-for="s in diagnoseResult.stories.filter(r => r.hasIssues)"
            :key="s.storyId"
            class="diagnose-item"
          >
            <div class="story-row">
              <div class="story-info">
                <span class="warn-badge">⚠️</span>
                <router-link :to="`/story/${s.storyId}`" class="story-link">
                  <strong>{{ s.title }}</strong>
                </router-link>
                <span class="story-id">#{{ s.storyId.slice(0, 8) }}</span>
                <span class="entry-count">{{ s.entryCount }}段</span>
              </div>
              <button
                class="btn-warning btn-sm"
                :disabled="fixingId === s.storyId"
                @click="doFixOne(s.storyId)"
              >
                {{ fixingId === s.storyId ? '修复中...' : '修复此故事' }}
              </button>
            </div>
            <ul class="issue-list">
              <li v-for="(issue, idx) in s.issues" :key="idx" class="issue-item">
                <span class="issue-type">{{ issue.name }}</span>
                <span class="issue-diff">
                  实际: <code>{{ issue.actual }}</code>
                  →
                  应为: <code>{{ issue.expected }}</code>
                </span>
                <span v-if="issue.type === 'order'" class="issue-detail">
                  ({{ issue.details.length }}处错位)
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="admin-content card">
        <div v-if="loading" class="loading">正在加载...</div>

        <div v-else-if="stories.length === 0" class="empty">
          <div class="empty-icon">📭</div>
          <p>暂无故事数据</p>
        </div>

        <template v-else>
          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>故事标题</th>
                  <th class="num-col">参与人数</th>
                  <th class="num-col">段数</th>
                  <th class="num-col">字数</th>
                  <th class="status-col">状态</th>
                  <th class="time-col">最后更新</th>
                  <th class="action-col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in stories" :key="s.id">
                  <td class="title-cell">
                    <router-link :to="`/story/${s.id}`" class="story-link">
                      <span class="story-name">{{ s.title }}</span>
                    </router-link>
                    <span class="story-id">#{{ s.id.slice(0, 8) }}</span>
                  </td>
                  <td class="num-col">
                    <span
                      :class="['num-val', s.participantCount >= 10 ? 'num-warn' : '']"
                    >
                      {{ s.participantCount }}/10
                    </span>
                  </td>
                  <td class="num-col">{{ s.entryCount }}</td>
                  <td class="num-col">
                    <span
                      :class="['num-val', s.totalChars >= 5000 ? 'num-warn' : '']"
                    >
                      {{ s.totalChars }}/5000
                    </span>
                  </td>
                  <td class="status-col">
                    <span
                      :class="['tag', s.locked ? 'tag-success' : 'tag-warning']"
                    >
                      {{ s.locked ? '已完结' : '进行中' }}
                    </span>
                  </td>
                  <td class="time-col">
                    <span class="time">{{ formatTime(s.updatedAt) }}</span>
                  </td>
                  <td class="action-col">
                    <div class="actions">
                      <button
                        class="btn-secondary btn-sm"
                        @click="viewStory(s.id)"
                      >查看</button>
                      <button
                        class="btn-danger btn-sm"
                        :disabled="resetting === s.id || s.entryCount <= 1"
                        @click="askReset(s)"
                      >
                        {{ resetting === s.id ? '重置中...' : '重置' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            共 <strong>{{ stories.length }}</strong> 篇故事
          </div>
        </template>
      </section>
    </div>

    <div
      v-if="confirmVisible"
      class="modal-mask"
      @click.self="confirmVisible = false"
    >
      <div class="modal card confirm-modal">
        <div class="modal-header danger">
          <h3>⚠️ 确认重置</h3>
          <button class="close-btn" @click="confirmVisible = false">×</button>
        </div>
        <div class="modal-body">
          <div class="confirm-content">
            <div class="confirm-icon">💥</div>
            <p class="confirm-text">
              确定要重置故事 <strong>{{ targetStory?.title }}</strong> 吗？
            </p>
            <ul class="confirm-info">
              <li>当前 <strong>{{ targetStory?.entryCount }}</strong> 段接龙将被清除</li>
              <li>只保留开篇第一段内容</li>
              <li>重置后状态将变为「进行中」</li>
              <li>此操作不可撤销</li>
            </ul>
          </div>
          <div v-if="resetError" class="error-text">{{ resetError }}</div>
        </div>
        <div class="modal-footer">
          <button
            class="btn-secondary"
            :disabled="resetting === targetStory?.id"
            @click="confirmVisible = false"
          >
            取消
          </button>
          <button
            class="btn-danger"
            :disabled="resetting === targetStory?.id"
            @click="doReset"
          >
            {{ resetting === targetStory?.id ? '正在重置...' : '确认重置' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast.show" :class="['toast', toast.type]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'
import { formatTime } from '../utils.js'

const router = useRouter()
const stories = ref([])
const loading = ref(false)
const resetting = ref(null)
const resetError = ref('')
const confirmVisible = ref(false)
const targetStory = ref(null)

const diagnoseResult = ref(null)
const diagnoseTime = ref(0)
const diagnosing = ref(false)
const fixingId = ref(null)
const fixingAll = ref(false)

const toast = ref({ show: false, message: '', type: 'success' })

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => (toast.value.show = false), 2800)
}

async function loadStories() {
  loading.value = true
  try {
    stories.value = await api.getStories()
  } catch (e) {
    showToast('加载失败：' + e.message, 'error')
  } finally {
    loading.value = false
  }
}

async function runDiagnose() {
  diagnosing.value = true
  try {
    diagnoseResult.value = await api.diagnose()
    diagnoseTime.value = Date.now()
    if (diagnoseResult.value.issueCount === 0) {
      showToast('体检完成，未发现异常 🎉', 'success')
    } else {
      showToast(`体检完成，发现 ${diagnoseResult.value.issueCount} 个异常故事`, 'error')
    }
  } catch (e) {
    showToast('体检失败：' + e.message, 'error')
  } finally {
    diagnosing.value = false
  }
}

async function doFixOne(storyId) {
  fixingId.value = storyId
  try {
    const result = await api.fixStory(storyId)
    showToast('修复成功', 'success')
    if (diagnoseResult.value) {
      const idx = diagnoseResult.value.stories.findIndex(s => s.storyId === storyId)
      if (idx >= 0) {
        diagnoseResult.value.stories[idx] = result.diagnosis
        diagnoseResult.value.issueCount = diagnoseResult.value.stories.filter(s => s.hasIssues).length
        diagnoseResult.value.totalIssues = diagnoseResult.value.stories.reduce((sum, s) => sum + s.issues.length, 0)
      }
    }
    await loadStories()
  } catch (e) {
    showToast('修复失败：' + e.message, 'error')
  } finally {
    fixingId.value = null
  }
}

async function doFixAll() {
  if (!confirm('确定要一键修复所有异常故事吗？')) return
  fixingAll.value = true
  try {
    const result = await api.fixAllStories()
    showToast(`批量修复完成，共修复 ${result.fixedCount} 个故事`, 'success')
    await runDiagnose()
    await loadStories()
  } catch (e) {
    showToast('批量修复失败：' + e.message, 'error')
  } finally {
    fixingAll.value = false
  }
}

function viewStory(id) {
  router.push(`/story/${id}`)
}

function askReset(story) {
  targetStory.value = story
  resetError.value = ''
  confirmVisible.value = true
}

async function doReset() {
  if (!targetStory.value) return
  resetError.value = ''
  resetting.value = targetStory.value.id
  try {
    await api.resetStory(targetStory.value.id)
    confirmVisible.value = false
    showToast('故事已重置成功')
    await loadStories()
  } catch (e) {
    resetError.value = e.message
  } finally {
    resetting.value = null
  }
}

onMounted(loadStories)
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 10px;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-primary:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-warning {
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-warning:hover {
  filter: brightness(1.05);
}

.btn-warning:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.admin-header {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fee2e2 100%);
  border-color: #fed7aa;
}

.admin-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.diagnose-panel {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
  border-color: #c7d2fe;
}

.diagnose-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.diagnose-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diagnose-title h2 {
  font-size: 18px;
  margin: 0;
}

.diagnose-icon {
  font-size: 24px;
}

.diagnose-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 8px;
}

.diagnose-stats {
  display: flex;
  gap: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  background: white;
  border-radius: var(--radius-sm);
  min-width: 80px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-ok .stat-value {
  color: var(--success);
}

.stat-warn .stat-value {
  color: var(--error);
}

.diagnose-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding: 14px;
  background: #fef2f2;
  border-radius: var(--radius-sm);
  border: 1px dashed #fecaca;
}

.fix-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.all-good {
  text-align: center;
  padding: 30px 20px;
}

.good-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.all-good p {
  font-size: 16px;
  color: var(--success);
  font-weight: 500;
  margin: 0;
}

.diagnose-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.diagnose-item {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
}

.story-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.story-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.warn-badge {
  font-size: 18px;
}

.story-info .story-link {
  color: var(--primary);
  font-weight: 600;
}

.story-info .story-id {
  font-size: 11px;
  color: var(--text-light);
  font-family: monospace;
}

.entry-count {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--surface-alt);
  border-radius: 4px;
  color: var(--text-muted);
}

.issue-list {
  list-style: none;
  padding: 12px;
  margin: 0;
  background: #fffbeb;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
}

.issue-item + .issue-item {
  border-top: 1px dashed #fde68a;
}

.issue-type {
  padding: 2px 8px;
  background: #f59e0b;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.issue-diff {
  color: var(--text-muted);
}

.issue-diff code {
  padding: 1px 6px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.issue-detail {
  margin-left: auto;
  color: var(--error);
  font-size: 12px;
}

@media (max-width: 640px) {
  .admin-header-inner {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-actions {
    width: 100%;
  }
  .header-actions button {
    flex: 1;
  }
  .diagnose-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .diagnose-stats {
    width: 100%;
    justify-content: space-between;
  }
  .stat-item {
    flex: 1;
    padding: 8px 10px;
    min-width: 0;
  }
  .stat-value {
    font-size: 18px;
  }
  .diagnose-actions {
    flex-direction: column;
    align-items: flex-start;
  }
  .story-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .confirm-info {
    padding: 12px 14px;
  }
}

.admin-header h1 {
  font-size: 22px;
  margin-bottom: 4px;
}

.admin-subtitle {
  color: var(--text-muted);
  font-size: 14px;
}

.table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.admin-table thead th {
  text-align: left;
  padding: 12px 14px;
  background: var(--surface-alt);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.admin-table tbody td {
  padding: 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.admin-table tbody tr:hover {
  background: var(--surface-alt);
}

.admin-table tbody tr:last-child td {
  border-bottom: none;
}

.num-col {
  text-align: center;
  white-space: nowrap;
}

.status-col,
.time-col,
.action-col {
  text-align: center;
  white-space: nowrap;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.story-link {
  display: inline;
}

.story-name {
  font-weight: 500;
  color: var(--text);
}

.story-link:hover .story-name {
  color: var(--primary);
}

.story-id {
  font-size: 11px;
  color: var(--text-light);
  font-family: monospace;
}

.num-val {
  font-variant-numeric: tabular-nums;
}

.num-warn {
  color: var(--error);
  font-weight: 600;
}

.time {
  font-size: 13px;
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.table-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  text-align: right;
  color: var(--text-muted);
  font-size: 13px;
}

.table-footer strong {
  color: var(--primary);
  font-size: 16px;
  margin: 0 4px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 460px;
}

.confirm-modal {
  animation: zoomIn 0.2s ease;
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.modal-header.danger h3 {
  color: var(--error);
}

.modal-header h3 {
  font-size: 18px;
}

.close-btn {
  background: none;
  font-size: 28px;
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  padding: 0;
  line-height: 1;
  border-radius: 50%;
}

.close-btn:hover {
  background: var(--surface-alt);
  color: var(--text);
}

.confirm-content {
  text-align: center;
  margin-bottom: 16px;
}

.confirm-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.confirm-text {
  font-size: 16px;
  margin-bottom: 14px;
}

.confirm-text strong {
  color: var(--primary);
}

.confirm-info {
  text-align: left;
  list-style: none;
  background: var(--surface-alt);
  padding: 14px 18px;
  border-radius: var(--radius-sm);
}

.confirm-info li {
  padding: 4px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.confirm-info li::before {
  content: '• ';
  color: var(--error);
  font-weight: bold;
}

.confirm-info strong {
  color: var(--error);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  margin-top: 8px;
}

.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: var(--shadow-lg);
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.toast.success {
  background: var(--success);
}

.toast.error {
  background: var(--error);
}

@media (max-width: 640px) {
  .admin-header-inner {
    flex-direction: column;
    align-items: flex-start;
  }
  .confirm-info {
    padding: 12px 14px;
  }
}
</style>
