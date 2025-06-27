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
        <el-table-column label="操作" width="180">
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
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 空の場合のメッセージ -->
      <div v-if="recordings.length === 0 && !isLoading" class="empty-message">
        録音ファイルがありません
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const recordings = ref<any[]>([])
const isLoading = ref(false)
const playingFile = ref<string | null>(null)
let currentAudio: HTMLAudioElement | null = null

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
</style>