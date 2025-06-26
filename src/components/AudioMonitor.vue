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
      
      <!-- 音量メーター -->
      <div class="volume-meter">
        <label>音量レベル: {{ volumeDb }} dB</label>
        <el-progress 
          :percentage="volumePercentage" 
          :color="volumeColor"
          :stroke-width="20"
        />
      </div>
      
      <!-- VAD状態 -->
      <div class="vad-status">
        <span :class="['status-dot', { active: isSpeaking }]"></span>
        <span>{{ isSpeaking ? '音声検出中' : '無音' }}</span>
      </div>
      
      <!-- 波形表示 -->
      <canvas ref="waveformCanvas" width="600" height="100"></canvas>
      
      <!-- 環境ノイズレベル -->
      <div class="noise-level">
        <label>環境ノイズ: {{ noiseLevel }} dB</label>
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

const { startMonitoring, stopMonitoring, restartMonitoring } = useAudioMonitor({
  onVolumeUpdate: (db: number, percentage: number) => {
    volumeDb.value = db
    volumePercentage.value = percentage
  },
  onVadUpdate: (speaking: boolean) => {
    isSpeaking.value = speaking
  },
  onWaveformUpdate: (data: Float32Array) => {
    drawWaveform(data)
  },
  onNoiseLevel: (level: number) => {
    noiseLevel.value = level
  },
  deviceId: selectedDeviceId.value
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

.volume-meter {
  margin-bottom: 20px;
}

.vad-status {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  font-size: 16px;
}

.status-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
  margin-right: 8px;
}

.status-dot.active {
  background: #67c23a;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

canvas {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 20px;
}

.noise-level {
  font-size: 14px;
  color: #666;
}
</style>