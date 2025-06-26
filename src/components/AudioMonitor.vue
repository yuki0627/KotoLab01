<template>
  <div class="audio-monitor">
    <div class="monitor-section">
      <h3>リアルタイムモニター</h3>
      
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAudioMonitor } from '../composables/useAudioMonitor'

const volumeDb = ref(-60)
const volumePercentage = ref(0)
const isSpeaking = ref(false)
const noiseLevel = ref(-50)
const waveformCanvas = ref<HTMLCanvasElement>()

const volumeColor = computed(() => {
  if (volumeDb.value > -10) return '#f56c6c' // 赤（音量大）
  if (volumeDb.value > -30) return '#e6a23c' // オレンジ
  return '#67c23a' // 緑（適正）
})

const { startMonitoring, stopMonitoring } = useAudioMonitor({
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
  }
})

onMounted(() => {
  startMonitoring()
})

onUnmounted(() => {
  stopMonitoring()
})

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