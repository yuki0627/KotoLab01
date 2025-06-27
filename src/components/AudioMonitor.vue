<template>
  <div class="audio-monitor">
    <div class="monitor-section">
      <h3>リアルタイムモニター</h3>
      
      <!-- マイク選択 -->
      <div class="device-selection">
        <label>マイク選択:</label>
        <el-select 
          v-model="selectedDeviceId" 
          placeholder="マイクを選択"
          @change="onDeviceChange"
          :loading="isDeviceLoading"
        >
          <el-option
            v-for="device in audioDevices"
            :key="device.deviceId"
            :label="device.label"
            :value="device.deviceId"
          />
        </el-select>
        <el-button 
          size="small" 
          @click="refreshDevices"
          :loading="isDeviceLoading"
        >
          マイク一覧更新
        </el-button>
      </div>
      
      <!-- 音量メーター（2段表示） -->
      <div class="volume-meters">
        <!-- 全体音量メーター -->
        <div class="volume-meter">
          <label>音量レベル: {{ volumeDb }} dB</label>
          <div class="meter-container">
            <el-progress 
              :percentage="volumePercentage" 
              :color="volumeColor"
              :stroke-width="20"
            />
            <!-- 閾値ライン -->
            <div 
              class="threshold-line" 
              :style="{ left: thresholdPosition + '%' }"
              :title="`閾値: ${vadThreshold} dB`"
            >
              <span class="threshold-label">{{ vadThreshold }} dB</span>
            </div>
          </div>
        </div>
        
      </div>
      
      <!-- VAD状態と録音状態 -->
      <div class="status-section">
        <div class="vad-status">
          <span :class="['status-dot', { 'vad-active': isSpeaking, 'vad-inactive': !isSpeaking }]"></span>
          <span>{{ isSpeaking ? '音声検出中' : '無音' }} </span>
        </div>
        
        <!-- 録音状態インジケーター -->
        <div class="recording-status">
          <span :class="['status-dot', recordingStatusClass]"></span>
          <span class="recording-text">{{ recordingStatusText }}</span>
        </div>
      </div>
      
      <!-- 波形表示 -->
      <canvas ref="waveformCanvas" width="600" height="100"></canvas>
      
      <!-- 環境ノイズレベル -->
      <div class="noise-level">
        <label>環境ノイズ: {{ noiseLevel }} dB</label>
      </div>
      
      <!-- VAD閾値設定 -->
      <div class="vad-threshold-setting">
        <label>音声検出閾値: {{ vadThreshold }} dB</label>
        <el-slider
          v-model="vadThreshold"
          :min="-60"
          :max="-10"
          :step="1"
          :marks="vadThresholdMarks"
          @change="onVadThresholdChange"
        />
        <div class="threshold-hint">
          <span v-if="vadThreshold >= -20">大きな声のみ検出</span>
          <span v-else-if="vadThreshold >= -35">通常の話し声を検出</span>
          <span v-else-if="vadThreshold >= -45">小さな声も検出</span>
          <span v-else>非常に敏感（ノイズも拾いやすい）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAudioMonitor } from '../composables/useAudioMonitor'
import { useAudioDevices } from '../composables/useAudioDevices'

const volumeDb = ref(-60)
const volumePercentage = ref(0)
const isSpeaking = ref(false)
const noiseLevel = ref(-50)
const waveformCanvas = ref<HTMLCanvasElement>()
const vadThreshold = ref(-35)  // VAD閾値

// Props定義
interface Props {
  isRecording?: boolean
  autoRecordEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isRecording: false,
  autoRecordEnabled: false
})

// Emit定義
const emit = defineEmits<{
  'vad-changed': [boolean]
}>()

// スライダー用マーク
const vadThresholdMarks = {
  '-60': '-60',
  '-35': '推奨',
  '-10': '-10'
}


// 閾値の位置計算（0-100%）
const thresholdPosition = computed(() => {
  // -60dB を 0%、-10dB を 100% とする
  return ((vadThreshold.value + 60) / 50) * 100
})

// 録音状態表示
const recordingStatusClass = computed(() => {
  if (props.isRecording) return 'recording'
  if (props.autoRecordEnabled && isSpeaking.value) return 'auto-recording'
  if (props.autoRecordEnabled) return 'waiting'
  return 'stopped'
})

const recordingStatusText = computed(() => {
  if (props.isRecording) return 'REC'
  if (props.autoRecordEnabled && isSpeaking.value) return '自動録音中'
  if (props.autoRecordEnabled) return '自動録音待機'
  return '録音停止'
})


// オーディオデバイス管理
const { 
  audioDevices, 
  selectedDeviceId, 
  isLoading: isDeviceLoading,
  getAudioDevices,
  selectDevice 
} = useAudioDevices()

const volumeColor = computed(() => {
  if (volumeDb.value > -10) return '#f56c6c' // 赤（音量大）
  if (volumeDb.value > -30) return '#e6a23c' // オレンジ
  return '#67c23a' // 緑（適正）
})

const { startMonitoring, stopMonitoring, restartMonitoring, setVadThreshold } = useAudioMonitor({
  onVolumeUpdate: (db: number, percentage: number) => {
    volumeDb.value = db
    volumePercentage.value = percentage
  },
  onVadUpdate: (speaking: boolean) => {
    const wasChanged = isSpeaking.value !== speaking
    isSpeaking.value = speaking
    
    if (wasChanged) {
      emit('vad-changed', speaking)
    }
  },
  onWaveformUpdate: (data: Float32Array) => {
    drawWaveform(data)
  },
  onNoiseLevel: (level: number) => {
    noiseLevel.value = level
  },
  deviceId: selectedDeviceId.value,
  vadThreshold: vadThreshold.value
})

// デバイス変更を監視
watch(selectedDeviceId, (newDeviceId) => {
  if (newDeviceId) {
    restartMonitoring()
  }
})

onMounted(() => {
  startMonitoring()
})

onUnmounted(() => {
  stopMonitoring()
})

// デバイス選択変更時
function onDeviceChange(deviceId: string) {
  selectDevice(deviceId)
}

// デバイス一覧更新
function refreshDevices() {
  getAudioDevices()
}

// VAD閾値変更時
function onVadThresholdChange(value: number) {
  setVadThreshold(value)
}

// 波形描画
function drawWaveform(data: Float32Array) {
  const canvas = waveformCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')!
  const width = canvas.width
  const height = canvas.height
  
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, width, height)
  
  ctx.lineWidth = 2
  ctx.strokeStyle = isSpeaking.value ? '#67c23a' : '#909399'
  ctx.beginPath()
  
  const sliceWidth = width / data.length
  let x = 0
  
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    const y = (v + 1) / 2 * height
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    
    x += sliceWidth
  }
  
  ctx.stroke()
}
</script>

<style scoped>
.audio-monitor {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.device-selection {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-selection label {
  font-weight: bold;
  min-width: 80px;
}

.volume-meters {
  margin-bottom: 20px;
}

.volume-meter {
  margin-bottom: 15px;
}

.meter-container {
  position: relative;
  margin-top: 8px;
}

.threshold-line {
  position: absolute;
  top: -5px;
  bottom: -5px;
  width: 2px;
  background-color: #f56c6c;
  z-index: 10;
  transition: left 0.3s ease;
}

.threshold-line::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -4px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #f56c6c;
  transform: translateY(-50%);
}

.threshold-label {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #f56c6c;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}


.status-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vad-status {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
}

.recording-status {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
}

.status-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 8px;
  transition: all 0.3s ease;
}

.status-dot.vad-active {
  background: #67c23a;
  animation: pulse 1s infinite;
}

.status-dot.vad-inactive {
  background: #909399;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.status-dot.recording {
  background: #f56c6c;
  animation: pulse 0.8s infinite;
  box-shadow: 0 0 10px rgba(245, 108, 108, 0.5);
}

.status-dot.auto-recording {
  background: #e6a23c;
  animation: pulse 1s infinite;
  box-shadow: 0 0 8px rgba(230, 162, 60, 0.5);
}

.status-dot.waiting {
  background: #909399;
  animation: pulse 2s infinite;
}

.status-dot.stopped {
  background: #dcdfe6;
}

.recording-text {
  color: #606266;
}

.status-dot.recording + .recording-text {
  color: #f56c6c;
}

.status-dot.auto-recording + .recording-text {
  color: #e6a23c;
}

canvas {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 20px;
}

.noise-level {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.vad-threshold-setting {
  margin-top: 20px;
  padding: 15px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.vad-threshold-setting label {
  font-weight: bold;
  display: block;
  margin-bottom: 10px;
}

.threshold-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>