import { ref, onUnmounted } from 'vue'

interface AudioMonitorOptions {
  onVolumeUpdate: (db: number, percentage: number) => void
  onVadUpdate: (isSpeaking: boolean) => void
  onWaveformUpdate: (data: Float32Array) => void
  onNoiseLevel: (level: number) => void
}

export function useAudioMonitor(options: AudioMonitorOptions) {
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let microphone: MediaStreamAudioSourceNode | null = null
  let animationId: number | null = null
  
  const isMonitoring = ref(false)
  
  async function startMonitoring() {
    try {
      // マイクアクセス
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      })
      
      // Audio Context設定
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      
      microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)
      
      isMonitoring.value = true
      
      // モニタリングループ
      const dataArray = new Float32Array(analyser.frequencyBinCount)
      
      function updateMonitor() {
        if (!isMonitoring.value) return
        
        analyser!.getFloatTimeDomainData(dataArray)
        
        // 音量計算（RMS）
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const db = 20 * Math.log10(rms)
        const percentage = Math.min(100, Math.max(0, (db + 60) * 1.67))
        
        options.onVolumeUpdate(Math.round(db), Math.round(percentage))
        
        // 簡易VAD（エネルギーベース）
        const isSpeaking = db > -35 // 閾値は調整可能
        options.onVadUpdate(isSpeaking)
        
        // 波形データ
        options.onWaveformUpdate(dataArray)
        
        animationId = requestAnimationFrame(updateMonitor)
      }
      
      updateMonitor()
      
      // 初期ノイズレベル計測（1秒後）
      setTimeout(() => {
        const noise = calculateNoiseFloor(dataArray)
        options.onNoiseLevel(noise)
      }, 1000)
      
    } catch (error) {
      console.error('マイクアクセスエラー:', error)
    }
  }
  
  function stopMonitoring() {
    isMonitoring.value = false
    if (animationId) cancelAnimationFrame(animationId)
    if (audioContext) audioContext.close()
  }
  
  function calculateNoiseFloor(data: Float32Array): number {
    // ノイズフロア計算ロジック
    return -50 // 仮の値
  }
  
  onUnmounted(() => {
    stopMonitoring()
  })
  
  return {
    isMonitoring,
    startMonitoring,
    stopMonitoring
  }
}