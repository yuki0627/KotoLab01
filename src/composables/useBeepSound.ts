import { ref } from 'vue'

interface BeepOptions {
  frequency?: number    // 周波数（Hz）デフォルト: 800Hz
  duration?: number     // 持続時間（ms）デフォルト: 200ms
  volume?: number       // 音量（0-1）デフォルト: 0.1
  interval?: number     // 間隔（ms）デフォルト: 3000ms
}

export function useBeepSound() {
  const isBeepEnabled = ref(true)
  const isBeeping = ref(false)
  
  let audioContext: AudioContext | null = null
  let beepInterval: ReturnType<typeof setInterval> | null = null
  
  // AudioContextの初期化
  function initAudioContext() {
    if (!audioContext) {
      audioContext = new AudioContext()
    }
  }
  
  // 単発ビープ音の再生
  function playBeep(options: BeepOptions = {}) {
    if (!isBeepEnabled.value) return
    
    const {
      frequency = 800,    // 控えめな周波数
      duration = 200,     // 短い持続時間
      volume = 0.1        // 低い音量
    } = options
    
    try {
      initAudioContext()
      if (!audioContext) return
      
      // オシレーター（音の生成）
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      // 音の設定
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = 'sine' // 優しい音色
      
      // 音量の設定とフェードアウト
      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000)
      
      // 接続
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // 再生
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration / 1000)
      
    } catch (error) {
      console.error('ビープ音の再生に失敗:', error)
    }
  }
  
  // 定期的なビープ音の開始
  function startPeriodicBeep(options: BeepOptions = {}) {
    if (!isBeepEnabled.value || isBeeping.value) return
    
    const { interval = 3000 } = options // 3秒間隔
    
    isBeeping.value = true
    
    // 最初のビープ音
    playBeep(options)
    
    // 定期的なビープ音
    beepInterval = setInterval(() => {
      if (isBeepEnabled.value) {
        playBeep(options)
      }
    }, interval)
  }
  
  // 定期的なビープ音の停止
  function stopPeriodicBeep() {
    isBeeping.value = false
    if (beepInterval) {
      clearInterval(beepInterval)
      beepInterval = null
    }
  }
  
  // ビープ音の有効/無効切り替え
  function toggleBeep() {
    isBeepEnabled.value = !isBeepEnabled.value
    if (!isBeepEnabled.value && isBeeping.value) {
      stopPeriodicBeep()
    }
  }
  
  // ビープ音設定の変更
  function setBeepEnabled(enabled: boolean) {
    isBeepEnabled.value = enabled
    if (!enabled && isBeeping.value) {
      stopPeriodicBeep()
    }
  }
  
  // クリーンアップ
  function cleanup() {
    stopPeriodicBeep()
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
  }
  
  return {
    isBeepEnabled,
    isBeeping,
    playBeep,
    startPeriodicBeep,
    stopPeriodicBeep,
    toggleBeep,
    setBeepEnabled,
    cleanup
  }
}