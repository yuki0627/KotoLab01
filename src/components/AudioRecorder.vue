<template>
  <div class="audio-recorder">
    <div class="recorder-section">
      <h3>録音コントロール</h3>
      
      <!-- タブ -->
      <el-tabs v-model="activeTab" class="recording-tabs">
        <!-- 手動録音タブ -->
        <el-tab-pane label="手動録音" name="manual">
          <div class="manual-controls">
            <div class="controls">
              <el-button 
                type="primary" 
                size="large"
                :disabled="isRecording || autoRecordActive"
                @click="startManualRecording"
              >
                録音開始
              </el-button>
              
              <el-button 
                type="danger" 
                size="large"
                :disabled="!isRecording"
                @click="stopManualRecording"
              >
                録音停止
              </el-button>
            </div>
            
            <!-- 手動録音状態 -->
            <div class="recording-status">
              <p>状態: {{ manualRecordingStatus }}</p>
              <p v-if="isRecording">録音時間: {{ recordingTime }}秒</p>
            </div>
          </div>
        </el-tab-pane>
        
        <!-- 自動録音タブ -->
        <el-tab-pane label="自動録音" name="auto">
          <div class="auto-controls">
            <div class="controls">
              <el-button 
                type="success" 
                size="large"
                :disabled="autoRecordActive || isRecording"
                @click="startAutoRecord"
              >
                自動録音開始
              </el-button>
              
              <el-button 
                type="warning" 
                size="large"
                :disabled="!autoRecordActive"
                @click="stopAutoRecord"
              >
                自動録音停止
              </el-button>
            </div>
            
            <!-- 自動録音状態 -->
            <div class="recording-status">
              <p>状態: {{ autoRecordingStatus }}</p>
              <p v-if="autoRecordActive">
                {{ autoRecordCurrentlyRecording ? '音声録音中' : '音声待機中' }}
              </p>
            </div>
            
            <!-- 自動録音設定 -->
            <div class="auto-record-settings">
              <div class="silence-duration-setting">
                <label>録音停止までの無音時間: {{ silenceDuration }} 秒</label>
                <el-slider
                  v-model="silenceDuration"
                  :min="0.5"
                  :max="5"
                  :step="0.5"
                  :marks="silenceDurationMarks"
                  @change="onSilenceDurationChange"
                />
                <div class="setting-hint">
                  短いほど敏感に停止、長いほど余裕を持って録音継続
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAudioDevices } from '../composables/useAudioDevices'

const isRecording = ref(false)
const autoRecord = ref(false)
const autoRecordActive = ref(false)
const autoRecordCurrentlyRecording = ref(false)
const activeTab = ref('manual')
const silenceDuration = ref(1)  // 無音時間（秒）

// emitの定義
const emit = defineEmits<{
  'recording-changed': [boolean]
  'auto-record-changed': [boolean]
  'silence-duration-changed': [number]
  'recording-completed': []
}>()

// スライダー用マーク
const silenceDurationMarks = {
  '0.5': '0.5s',
  '1': '1s',
  '2': '2s',
  '5': '5s'
}
const recordingStatus = ref('待機中')
const recordingTime = ref(0)

// オーディオデバイス管理
const { selectedDeviceId } = useAudioDevices()

let mediaRecorder: MediaRecorder | null = null
let websocket: WebSocket | null = null
let recordingTimer: ReturnType<typeof setInterval> | null = null
let currentStream: MediaStream | null = null

// 状態表示用の計算プロパティ
const manualRecordingStatus = computed(() => {
  if (isRecording.value) return '録音中'
  if (autoRecordActive.value) return '自動録音が有効のため無効'
  return '待機中'
})

const autoRecordingStatus = computed(() => {
  if (!autoRecordActive.value) return '停止中'
  if (autoRecordCurrentlyRecording.value) return '音声録音中'
  return '音声待機中'
})


// 手動録音関数
async function startManualRecording() {
  try {
    // 既存のリソースをクリーンアップ
    await cleanupRecording()
    
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
    
    currentStream = await navigator.mediaDevices.getUserMedia(constraints)
    mediaRecorder = new MediaRecorder(currentStream)
    const chunks: Blob[] = []
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }
    
    mediaRecorder.onstop = async () => {
      try {
        if (chunks.length > 0 && chunks.some(chunk => chunk.size > 0)) {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          await sendToServer(blob)
        }
      } catch (error) {
        console.error('録音データ処理エラー:', error)
      }
      
      // リソースをクリーンアップ
      await cleanupRecording()
    }
    
    mediaRecorder.start(1000)
    
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
    await cleanupRecording()
  }
}

// リソースクリーンアップ関数
async function cleanupRecording() {
  // MediaRecorderを停止
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // ストリームを停止
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
    currentStream = null
  }
  
  // タイマーをクリア
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  
  // 変数をリセット
  mediaRecorder = null
}

function stopManualRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
    
    // 状態を即座に更新
    isRecording.value = false
    emit('recording-changed', false)
    recordingStatus.value = '待機中'
    
    ElMessage.success('録音を停止しました')
  }
}

async function sendToServer(blob: Blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    
    if (!websocket || websocket.readyState === WebSocket.CLOSED) {
      websocket = new WebSocket('ws://127.0.0.1:8000/ws/audio')
    }
    
    websocket.onopen = () => {
      websocket!.send(arrayBuffer)
    }
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      ElMessage.success(`録音ファイルを保存しました: ${data.filename}`)
      emit('recording-completed')
    }
    
    websocket.onerror = () => {
      ElMessage.error('サーバーとの通信に失敗しました')
    }
    
    // 既に接続済みの場合は即座に送信
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(arrayBuffer)
    }
    
  } catch (error) {
    ElMessage.error('ファイルの送信に失敗しました')
    console.error('送信エラー:', error)
  }
}


// 自動録音関数
function startAutoRecord() {
  autoRecordActive.value = true
  autoRecord.value = true
  emit('auto-record-changed', true)
  ElMessage.success('自動録音を開始しました')
  // TODO: VAD連動の自動録音ロジックを実装
}

function stopAutoRecord() {
  autoRecordActive.value = false
  autoRecord.value = false
  autoRecordCurrentlyRecording.value = false
  emit('auto-record-changed', false)
  
  // もし自動録音中だった場合は停止
  if (isRecording.value) {
    stopManualRecording()
  }
  
  ElMessage.info('自動録音を停止しました')
}

// 自動録音の実際の録音開始/停止（外部から呼ばれる）
async function startAutoRecording() {
  if (!autoRecordActive.value || isRecording.value) return
  
  autoRecordCurrentlyRecording.value = true
  await startManualRecording()
}

function stopAutoRecording() {
  if (!autoRecordCurrentlyRecording.value) return
  
  autoRecordCurrentlyRecording.value = false
  stopManualRecording()
}

// 無音時間変更時
function onSilenceDurationChange(value: number) {
  emit('silence-duration-changed', value)
}

// 外部からアクセス可能にする
defineExpose({
  startAutoRecording,
  stopAutoRecording
})
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

.auto-record-settings {
  margin-top: 20px;
}

.silence-duration-setting {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.silence-duration-setting label {
  font-weight: bold;
  display: block;
  margin-bottom: 10px;
}

.setting-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>