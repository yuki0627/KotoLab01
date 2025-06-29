import { ref, onUnmounted } from 'vue'

interface AudioMonitorOptions {
  onVolumeUpdate: (db: number, percentage: number) => void
  onVadUpdate: (isSpeaking: boolean) => void
  onWaveformUpdate: (data: Float32Array) => void
  onNoiseLevel: (level: number) => void
  deviceId?: string
  vadThreshold?: number  // VAD閾値（dB）
  vadHysteresis?: number // VADヒステリシス（dB）
  smoothingFactor?: number // 平滑化係数（0-1）
}

export function useAudioMonitor(options: AudioMonitorOptions) {
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let microphone: MediaStreamAudioSourceNode | null = null
  let animationId: number | null = null
  let previousSpeakingState: boolean | null = null  // VAD状態変化検出用
  let smoothedDb: number = -80  // 平滑化された音量値（初期値を低くする）
  
  const isMonitoring = ref(false)
  const vadThreshold = ref(options.vadThreshold ?? -35)  // デフォルト -35 dB
  const vadHysteresis = ref(options.vadHysteresis ?? 3)  // デフォルト 3 dB
  const smoothingFactor = ref(options.smoothingFactor ?? 0.7)  // デフォルト 0.7
  
  async function startMonitoring() {
    try {
      // マイクアクセス（デバイス指定対応）
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          ...(options.deviceId && { deviceId: { exact: options.deviceId } })
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
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
        
        // 音量の平滑化（急激な変化を抑える）
        // -Infinityの場合は現在の値で初期化
        if (!isFinite(smoothedDb)) {
          smoothedDb = db
        } else {
          smoothedDb = smoothedDb * (1 - smoothingFactor.value) + db * smoothingFactor.value
        }
        
        // UIには平滑化された値を表示（VAD判定と一致させる）
        const smoothedPercentage = Math.min(100, Math.max(0, (smoothedDb + 60) * 1.67))
        options.onVolumeUpdate(Math.round(smoothedDb), Math.round(smoothedPercentage))
        
        // ヒステリシス付きVAD（エネルギーベース） - 平滑化された値を使用
        // 録音開始は設定値、録音停止は設定値-ヒステリシス
        let isSpeaking: boolean
        
        if (previousSpeakingState === false) {
          // 現在無音状態 → 録音開始は通常の閾値
          isSpeaking = smoothedDb > vadThreshold.value
        } else {
          // 現在音声検出中 → 録音停止は閾値-ヒステリシス
          isSpeaking = smoothedDb > (vadThreshold.value - vadHysteresis.value)
        }
        
        // デバッグ：閾値を超えているのに状態が変わらない場合
        if (smoothedDb > vadThreshold.value && previousSpeakingState === false) {
          console.log(`⚡ 音声検出トリガー: 平滑化=${smoothedDb.toFixed(1)}dB > 閾値=${vadThreshold.value}dB`)
        }
        
        // デバッグ用：判定の詳細
        const debugInfo = {
          rawDb: db.toFixed(1),
          smoothedDb: smoothedDb.toFixed(1),
          threshold: vadThreshold.value,
          comparison: `${smoothedDb.toFixed(1)} > ${vadThreshold.value}`,
          result: isSpeaking,
          expected: smoothedDb > vadThreshold.value
        }
        
        // VAD状態が変化した時のみログ出力
        if (previousSpeakingState !== isSpeaking) {
          const effectiveThreshold = previousSpeakingState ? (vadThreshold.value - vadHysteresis.value) : vadThreshold.value
          console.log(`🔊 VAD状態変化: ${previousSpeakingState} → ${isSpeaking} (生音量=${db.toFixed(1)}dB, 平滑化=${smoothedDb.toFixed(1)}dB, 閾値=${effectiveThreshold}dB${previousSpeakingState ? ' [停止用]' : ' [開始用]'})`)
          console.log('   判定詳細:', debugInfo)
          
          previousSpeakingState = isSpeaking
        }
        
        // 定期的な状態確認（頻度調整）
        if (Math.random() < 0.005) { // 200回に1回
          console.log(`VAD状態確認: 生音量=${db.toFixed(1)}dB, 平滑化=${smoothedDb.toFixed(1)}dB, 閾値=${vadThreshold.value}dB, 音声検出=${isSpeaking}`)
        }
        
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
    if (microphone) {
      microphone.mediaStream.getTracks().forEach(track => track.stop())
      microphone.disconnect()
    }
    if (audioContext) audioContext.close()
  }
  
  function restartMonitoring() {
    stopMonitoring()
    setTimeout(() => startMonitoring(), 100)
  }
  
  function calculateNoiseFloor(data: Float32Array): number {
    // ノイズフロア計算ロジック
    return -50 // 仮の値
  }
  
  onUnmounted(() => {
    stopMonitoring()
  })
  
  function setVadThreshold(threshold: number) {
    vadThreshold.value = threshold
    console.log('VAD閾値を更新:', threshold, 'dB') // デバッグ用ログ
  }
  
  function setVadHysteresis(hysteresis: number) {
    vadHysteresis.value = hysteresis
    console.log('VADヒステリシスを更新:', hysteresis, 'dB') // デバッグ用ログ
  }
  
  function setSmoothingFactor(factor: number) {
    smoothingFactor.value = factor
    console.log('平滑化係数を更新:', factor) // デバッグ用ログ
  }

  return {
    isMonitoring,
    vadThreshold,
    vadHysteresis,
    smoothingFactor,
    startMonitoring,
    stopMonitoring,
    restartMonitoring,
    setVadThreshold,
    setVadHysteresis,
    setSmoothingFactor
  }
}