<template>
  <div class="container">
    <h1>Voice Recorder with VAD</h1>
    <AudioMonitor />
    <AudioRecorder />
  </div>
</template>

<script setup lang="ts">
import AudioMonitor from './components/AudioMonitor.vue'
import AudioRecorder from './components/AudioRecorder.vue'
</script>

<style>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>