<template>
  <div class="recording-history">
    <div class="history-section">
      <h3>録音履歴</h3>
      
      <!-- 更新ボタン -->
      <div class="history-controls">
        <el-button 
          size="default" 
          @click="loadRecordings"
          :loading="isLoading"
        >
          履歴更新
        </el-button>
      </div>
      
      <!-- 録音ファイル一覧 -->
      <el-table :data="recordings" style="width: 100%">
        <el-table-column prop="name" label="ファイル名" />
        <el-table-column prop="size" label="サイズ (KB)" width="100" />
        <el-table-column prop="created" label="作成日時" />
        <el-table-column label="転写状態" width="120">
          <template #default="scope">
            <el-tag 
              :type="getTranscriptionTagType(scope.row.transcription_status)"
              size="small"
            >
              {{ getTranscriptionStatusText(scope.row.transcription_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="scope">
            <div class="simple-controls">
              <el-button 
                v-if="playingFile !== scope.row.name"
                size="small" 
                type="primary"
                @click="playRecording(scope.row.name)"
              >
                再生
              </el-button>
              <el-button 
                v-else
                size="small" 
                type="warning"
                @click="stopRecording()"
              >
                停止
              </el-button>
              
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteRecording(scope.row.name)"
              >
                削除
              </el-button>
              
              <!-- 転写ボタン -->
              <el-button 
                v-if="scope.row.has_transcription"
                size="small" 
                type="success"
                @click="viewTranscription(scope.row.name)"
              >
                転写表示
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 空の場合のメッセージ -->
      <div v-if="recordings.length === 0 && !isLoading" class="empty-message">
        録音ファイルがありません
      </div>
    </div>
    
    <!-- 転写表示ダイアログ -->
    <el-dialog
      v-model="transcriptionDialogVisible"
      title="転写テキスト"
      width="80%"
      :before-close="closeTranscriptionDialog"
    >
      <div v-if="transcriptionLoading" class="transcription-loading">
        <el-loading text="転写テキストを読み込み中..." />
      </div>
      <div v-else-if="transcriptionError" class="transcription-error">
        <el-alert
          :title="transcriptionError"
          type="error"
          show-icon
          :closable="false"
        />
      </div>
      <div v-else class="transcription-content">
        <div class="transcription-filename">
          ファイル: {{ currentTranscriptionFilename }}
        </div>
        <el-input
          v-model="transcriptionText"
          type="textarea"
          :rows="15"
          readonly
          placeholder="転写テキストがここに表示されます"
        />
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeTranscriptionDialog">閉じる</el-button>
          <el-button 
            v-if="transcriptionText" 
            type="primary" 
            @click="downloadTranscription"
          >
            ダウンロード
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const recordings = ref<any[]>([])
const isLoading = ref(false)
const playingFile = ref<string | null>(null)
let currentAudio: HTMLAudioElement | null = null

// 転写関連の状態
const transcriptionDialogVisible = ref(false)
const transcriptionLoading = ref(false)
const transcriptionError = ref('')
const transcriptionText = ref('')
const currentTranscriptionFilename = ref('')

onMounted(() => {
  loadRecordings()
})

async function loadRecordings() {
  try {
    isLoading.value = true
    const response = await fetch('http://127.0.0.1:8000/recordings')
    const data = await response.json()
    recordings.value = data.recordings
      .map((r: any) => ({
        ...r,
        size: Math.round(r.size / 1024),
        created: new Date(r.created * 1000).toLocaleString(),
        createdTimestamp: r.created
      }))
      .sort((a: any, b: any) => b.createdTimestamp - a.createdTimestamp) // 新しい順にソート
  } catch (error) {
    console.error('録音履歴の取得に失敗:', error)
    ElMessage.error('録音履歴の取得に失敗しました')
  } finally {
    isLoading.value = false
  }
}

async function playRecording(filename: string) {
  try {
    // 既存の再生を停止
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    
    playingFile.value = filename
    currentAudio = new Audio(`http://127.0.0.1:8000/recordings/${filename}`)
    
    // 再生終了時
    currentAudio.onended = () => {
      stopRecording()
    }
    
    // エラー時
    currentAudio.onerror = () => {
      stopRecording()
      ElMessage.error('再生に失敗しました')
    }
    
    await currentAudio.play()
  } catch (error) {
    stopRecording()
    ElMessage.error('再生に失敗しました')
  }
}

async function deleteRecording(filename: string) {
  try {
    await ElMessageBox.confirm(
      `ファイル "${filename}" を削除してもよろしいですか？`,
      '確認',
      {
        confirmButtonText: '削除',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }
    )
    
    const response = await fetch(`http://127.0.0.1:8000/recordings/${filename}`, {
      method: 'DELETE'
    })
    
    const data = await response.json()
    
    if (response.ok) {
      ElMessage.success(data.message || '削除しました')
      loadRecordings()
    } else {
      ElMessage.error(data.error || '削除に失敗しました')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('削除に失敗しました')
      console.error('削除エラー:', error)
    }
  }
}

// 再生停止
function stopRecording() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  playingFile.value = null
}

// 転写状態のタグタイプを取得
function getTranscriptionTagType(status: string): string {
  switch (status) {
    case 'completed':
      return 'success'
    case 'processing':
      return 'warning'
    case 'pending':
      return 'info'
    case 'failed':
      return 'danger'
    default:
      return ''
  }
}

// 転写状態のテキストを取得
function getTranscriptionStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return '完了'
    case 'processing':
      return '処理中'
    case 'pending':
      return '待機中'
    case 'failed':
      return '失敗'
    case 'not_started':
      return '未実行'
    default:
      return '不明'
  }
}

// 転写テキストを表示
async function viewTranscription(filename: string) {
  try {
    transcriptionDialogVisible.value = true
    transcriptionLoading.value = true
    transcriptionError.value = ''
    transcriptionText.value = ''
    currentTranscriptionFilename.value = filename
    
    const response = await fetch(`http://127.0.0.1:8000/recordings/${filename}/transcription`)
    const data = await response.json()
    
    if (response.ok) {
      if (data.status === 'completed') {
        transcriptionText.value = data.text
      } else {
        transcriptionError.value = `転写が完了していません (状態: ${getTranscriptionStatusText(data.status)})`
        if (data.error) {
          transcriptionError.value += `\nエラー: ${data.error}`
        }
      }
    } else {
      transcriptionError.value = '転写テキストの取得に失敗しました'
    }
  } catch (error) {
    transcriptionError.value = '転写テキストの取得中にエラーが発生しました'
    console.error('転写取得エラー:', error)
  } finally {
    transcriptionLoading.value = false
  }
}

// 転写ダイアログを閉じる
function closeTranscriptionDialog() {
  transcriptionDialogVisible.value = false
  transcriptionText.value = ''
  transcriptionError.value = ''
  currentTranscriptionFilename.value = ''
}

// 転写テキストをダウンロード
function downloadTranscription() {
  if (!transcriptionText.value) return
  
  const baseFilename = currentTranscriptionFilename.value.split('.').slice(0, -1).join('.')
  const txtFilename = baseFilename + '.txt'
  
  const blob = new Blob([transcriptionText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = txtFilename
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  ElMessage.success('転写テキストをダウンロードしました')
}

// 外部から録音完了を通知される
function onRecordingCompleted() {
  loadRecordings()
}

// 外部からアクセス可能にする
defineExpose({
  onRecordingCompleted
})
</script>

<style scoped>
.recording-history {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #eee;
  margin-top: 20px;
}

.history-controls {
  margin-bottom: 15px;
  display: flex;
  justify-content: flex-end;
}

.empty-message {
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 14px;
}

.el-table {
  margin-top: 10px;
}

.simple-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
}

/* 転写ダイアログ関連のスタイル */
.transcription-loading {
  text-align: center;
  padding: 40px 0;
}

.transcription-error {
  margin-bottom: 20px;
}

.transcription-content {
  margin-bottom: 20px;
}

.transcription-filename {
  font-weight: bold;
  margin-bottom: 10px;
  color: #606266;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>