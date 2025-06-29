<template>
  <div class="container">
    <h1>Voice Recorder with VAD</h1>
    <AudioMonitor 
      :is-recording="isRecording"
      :auto-record-enabled="autoRecordEnabled"
      @vad-changed="handleVadChange"
    />
    <AudioRecorder 
      ref="audioRecorderRef"
      @recording-changed="isRecording = $event"
      @auto-record-changed="autoRecordEnabled = $event"
      @silence-duration-changed="silenceDuration = $event"
      @recording-completed="handleRecordingCompleted"
    />
    <RecordingHistory ref="recordingHistoryRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AudioMonitor from './components/AudioMonitor.vue'
import AudioRecorder from './components/AudioRecorder.vue'
import RecordingHistory from './components/RecordingHistory.vue'

const isRecording = ref(false)
const autoRecordEnabled = ref(false)
const isSpeaking = ref(false)
const silenceDuration = ref(5) // 秒 - デフォルト5秒
const audioRecorderRef = ref()
const recordingHistoryRef = ref()
let silenceTimer: ReturnType<typeof setTimeout> | null = null

// 録音状態の変化を監視
watch(isRecording, (newValue, oldValue) => {
  console.log(`📍 録音状態変化: ${oldValue} → ${newValue}`)
})

// シンプルなVAD状態変更処理
function handleVadChange(speaking: boolean) {
  isSpeaking.value = speaking
  
  // 自動録音が有効でない場合は何もしない
  if (!autoRecordEnabled.value) return
  
  if (speaking && !isRecording.value) {
    // 閾値を超えた → 録音開始
    console.log('🎤 録音開始: 音声検出（speaking=true, recording=false）')
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    audioRecorderRef.value?.startAutoRecording()
  } else if (!speaking && isRecording.value) {
    // 閾値を下回った → カウントダウン開始
    console.log('⏱️ カウントダウン開始: 無音検出（speaking=false, recording=true）')
    if (silenceTimer) {
      clearTimeout(silenceTimer)
    }
    
    // カウントダウン開始
    audioRecorderRef.value?.startSilenceCountdown()
    
    silenceTimer = setTimeout(() => {
      if (!isSpeaking.value && isRecording.value && autoRecordEnabled.value) {
        console.log('🛑 録音停止: 無音時間経過')
        audioRecorderRef.value?.stopAutoRecording()
      }
      silenceTimer = null
    }, silenceDuration.value * 1000)
  } else if (speaking && isRecording.value) {
    // 録音中に再び音声検出 → 停止タイマーとカウントダウンをキャンセル
    console.log('🔄 カウントダウンキャンセル: 音声再検出（speaking=true, recording=true）')
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    audioRecorderRef.value?.stopSilenceCountdown()
  }
}

// 録音完了時の処理
function handleRecordingCompleted() {
  recordingHistoryRef.value?.onRecordingCompleted()
}

</script>

<style>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>