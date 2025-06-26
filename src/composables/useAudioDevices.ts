import { ref, onMounted } from 'vue'

export interface AudioDevice {
  deviceId: string
  label: string
  kind: string
}

export function useAudioDevices() {
  const audioDevices = ref<AudioDevice[]>([])
  const selectedDeviceId = ref<string>('')
  const isLoading = ref(false)

  async function getAudioDevices() {
    isLoading.value = true
    try {
      // マイクアクセス許可を取得（デバイス一覧取得のため）
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // デバイス一覧を取得
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      // 音声入力デバイスのみフィルタ
      audioDevices.value = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `マイク ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }))
      
      // デフォルトデバイスを選択
      if (audioDevices.value.length > 0 && !selectedDeviceId.value) {
        selectedDeviceId.value = audioDevices.value[0].deviceId
      }
      
    } catch (error) {
      console.error('オーディオデバイスの取得に失敗:', error)
    } finally {
      isLoading.value = false
    }
  }

  function selectDevice(deviceId: string) {
    selectedDeviceId.value = deviceId
  }

  onMounted(() => {
    getAudioDevices()
  })

  return {
    audioDevices,
    selectedDeviceId,
    isLoading,
    getAudioDevices,
    selectDevice
  }
}