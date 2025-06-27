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
import { ref } from 'vue'
import AudioMonitor from './components/AudioMonitor.vue'
import AudioRecorder from './components/AudioRecorder.vue'
import RecordingHistory from './components/RecordingHistory.vue'

const isRecording = ref(false)
const autoRecordEnabled = ref(false)
const isSpeaking = ref(false)
const silenceDuration = ref(1) // 秒
const audioRecorderRef = ref()
const recordingHistoryRef = ref()
let silenceTimer: ReturnType<typeof setTimeout> | null = null

// VAD状態変更時の処理
function handleVadChange(speaking: boolean) {
  isSpeaking.value = speaking
  
  // 自動録音が有効な場合のみ処理
  if (!autoRecordEnabled.value) return
  
  if (speaking && !isRecording.value) {
    // 音声検出開始 → 録音開始
    // 既存のタイマーをクリア
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    audioRecorderRef.value?.startAutoRecording()
  } else if (!speaking && isRecording.value) {
    // 音声検出停止 → 設定された時間後に録音停止
    if (silenceTimer) {
      clearTimeout(silenceTimer)
    }
    
    silenceTimer = setTimeout(() => {
      // タイマー実行時に再度チェック
      if (!isSpeaking.value && isRecording.value && autoRecordEnabled.value) {
        audioRecorderRef.value?.stopAutoRecording()
      }
      silenceTimer = null
    }, silenceDuration.value * 1000)
  } else if (speaking && isRecording.value) {
    // 録音中に再び音声検出 → タイマーをクリア
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
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