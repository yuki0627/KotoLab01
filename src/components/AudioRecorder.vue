<template>
  <div class="audio-recorder">
    <div class="recorder-section">
      <h3>録音コントロール</h3>
      
      <!-- 録音ボタン -->
      <div class="controls">
        <el-button 
          type="primary" 
          size="large"
          :disabled="isRecording"
          @click="startRecording"
        >
          録音開始
        </el-button>
        
        <el-button 
          type="danger" 
          size="large"
          @click="stopRecording"
        >
          録音停止
        </el-button>
        
        <el-button 
          type="info" 
          size="large"
          @click="toggleAutoRecord"
        >
          自動録音: {{ autoRecord ? 'ON' : 'OFF' }}
        </el-button>
      </div>
      
      <!-- 録音状態 -->
      <div class="recording-status">
        <p>録音状態: {{ recordingStatus }}</p>
        <p v-if="isRecording">録音時間: {{ recordingTime }}秒</p>
      </div>
      
      <!-- 録音履歴 -->
      <div class="recording-history">
        <h4>録音履歴</h4>
        <el-table :data="recordings" style="width: 100%">
          <el-table-column prop="name" label="ファイル名" />
          <el-table-column prop="size" label="サイズ (KB)" />
          <el-table-column prop="created" label="作成日時" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button size="small" @click="playRecording(scope.row.name)">
                再生
              </el-button>
              <el-button size="small" type="danger" @click="deleteRecording(scope.row.name)">
                削除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAudioDevices } from '../composables/useAudioDevices'

const isRecording = ref(false)
const autoRecord = ref(false)

// emitの定義
const emit = defineEmits<{
  'recording-changed': [boolean]
  'auto-record-changed': [boolean]
}>()
const recordingStatus = ref('待機中')
const recordingTime = ref(0)
const recordings = ref<any[]>([])

// オーディオデバイス管理
const { selectedDeviceId } = useAudioDevices()

let mediaRecorder: MediaRecorder | null = null
let websocket: WebSocket | null = null
let recordingTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadRecordings()
})


async function startRecording() {
  try {
    // 選択されたデバイスで録音
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: 16000,
        ...(selectedDeviceId.value && { deviceId: { exact: selectedDeviceId.value } })
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    
    mediaRecorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    
    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data)
    }
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/wav' })
      await sendToServer(blob)
      stream.getTracks().forEach(track => track.stop())
    }
    
    mediaRecorder.start()
    isRecording.value = true
    emit('recording-changed', true)
    recordingStatus.value = '録音中'
    recordingTime.value = 0
    
    // 録音時間カウンター
    recordingTimer = setInterval(() => {
      recordingTime.value++
    }, 1000)
    
    ElMessage.success('録音を開始しました')
    
  } catch (error) {
    ElMessage.error('録音の開始に失敗しました')
    console.error('録音エラー:', error)
  }
}

function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop()
    isRecording.value = false
    emit('recording-changed', false)
    recordingStatus.value = '待機中'
    
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
    
    ElMessage.success('録音を停止しました')
  }
}

async function sendToServer(blob: Blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    
    if (!websocket) {
      websocket = new WebSocket('ws://127.0.0.1:8000/ws/audio')
    }
    
    websocket.onopen = () => {
      websocket!.send(arrayBuffer)
    }
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      ElMessage.success(`録音ファイルを保存しました: ${data.filename}`)
      loadRecordings()
    }
    
    websocket.onerror = () => {
      ElMessage.error('サーバーとの通信に失敗しました')
    }
    
  } catch (error) {
    ElMessage.error('ファイルの送信に失敗しました')
    console.error('送信エラー:', error)
  }
}

async function loadRecordings() {
  try {
    const response = await fetch('http://127.0.0.1:8000/recordings')
    const data = await response.json()
    recordings.value = data.recordings.map((r: any) => ({
      ...r,
      size: Math.round(r.size / 1024),
      created: new Date(r.created * 1000).toLocaleString()
    }))
  } catch (error) {
    console.error('録音履歴の取得に失敗:', error)
  }
}

function playRecording(filename: string) {
  const audio = new Audio(`http://127.0.0.1:8000/recordings/${filename}`)
  audio.play()
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

function toggleAutoRecord() {
  autoRecord.value = !autoRecord.value
  emit('auto-record-changed', autoRecord.value)
  ElMessage.info(`自動録音を${autoRecord.value ? '有効' : '無効'}にしました`)
}
</script>

<style scoped>
.audio-recorder {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.recording-status {
  margin-bottom: 20px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.recording-history {
  margin-top: 20px;
}

.recording-history h4 {
  margin-bottom: 10px;
}
</style>