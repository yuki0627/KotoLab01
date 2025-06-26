<template>
  <div class="container">
    <h1>Voice Recorder with VAD</h1>
    <AudioMonitor 
      :is-recording="isRecording"
      :auto-record-enabled="autoRecordEnabled"
    />
    <AudioRecorder 
      @recording-changed="isRecording = $event"
      @auto-record-changed="autoRecordEnabled = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AudioMonitor from './components/AudioMonitor.vue'
import AudioRecorder from './components/AudioRecorder.vue'

const isRecording = ref(false)
const autoRecordEnabled = ref(false)
</script>

<style>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>