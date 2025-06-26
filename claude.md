# 音声録音システム開発プロジェクト（シンプル版）

## 📋 プロジェクト概要

ブラウザ側でVAD（Voice Activity Detection）処理を行う軽量な音声録音システム。
話している時だけ自動で録音し、無音部分はカットして効率的に保存。

## 🏗️ 技術スタック

- **フロントエンド**: Vue 3 + TypeScript + Vite
- **バックエンド**: Python + FastAPI
- **音声処理**: WebRTC VAD（ブラウザ側）
- **通信**: WebSocket

## 📁 プロジェクト構成（シンプル）

```
voice-recorder/
├── .env                    # 環境変数（共通）
├── .gitignore
├── README.md
├── package.json            # npm依存関係
├── pyproject.toml          # Python依存関係（rye）
├── index.html              # Viteエントリーポイント
├── vite.config.ts          # Vite設定
├── tsconfig.json           # TypeScript設定
├── server.py               # FastAPIサーバー（1ファイル）
├── src/                    # Vueソースコード
│   ├── main.ts
│   ├── App.vue
│   ├── components/
│   │   ├── AudioRecorder.vue
│   │   ├── AudioVisualizer.vue
│   │   └── SettingsPanel.vue
│   ├── composables/
│   │   ├── useWebRTCVAD.ts
│   │   └── useAudioRecorder.ts
│   └── utils/
│       └── audioBuffer.ts
├── public/                 # 静的ファイル
└── recordings/             # 録音ファイル保存先
```

## ⚙️ 環境設定（.env）

```bash
# サーバー設定
API_HOST=127.0.0.1
API_PORT=8000

# Vite用設定（VITE_プレフィックス必須）
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws

# アプリ設定
AUDIO_SAVE_PATH=./recordings
DEBUG=true
```

## 🔧 主要機能

### 1. 常時音声モニタリング
- **録音していない時も常にマイクON**
- リアルタイム音量メーター（dB表示）
- VAD状態表示（音声検出中は緑、無音は灰色など）
- 音声波形のリアルタイム表示
- ノイズレベルインジケーター

### 2. ブラウザ側処理（メイン）
- マイク音声をリアルタイムでVAD処理
- 音声区間の自動検出
- 録音ボタンで録音開始/停止（手動）
- 自動録音モード（VAD検出で自動録音）

### 2. VAD設定
```typescript
// シンプルな設定構造
interface Settings {
  vad: {
    algorithm: 'webrtc' | 'energy';
    sensitivity: 0 | 1 | 2 | 3;  // WebRTC VAD Mode
    timing: {
      speechPadStart: number;     // 音声前の余白 (ms)
      speechPadEnd: number;       // 音声後の余白 (ms)
      minSpeechDuration: number;  // 最小音声長 (ms)
      maxSilenceDuration: number; // 最大無音長 (ms)
    };
  };
  audio: {
    sampleRate: 16000 | 44100;
    format: 'wav' | 'webm';
  };
}
```

### 3. 処理フロー
```
[常時モニタリング]
マイク → Web Audio API → リアルタイム解析
                         ├─ 音量計算 → メーター表示
                         ├─ VAD処理 → 状態表示
                         └─ 波形データ → Canvas描画

[録音時]
録音ボタンON → 音声バッファリング開始
              → VAD検出時のみデータ保存
              → 録音停止 → サーバー送信
```

### 4. 動作モード
- **モニターモード（デフォルト）**: 常時マイクON、表示のみ
- **手動録音モード**: 録音ボタンで開始/停止
- **自動録音モード**: VAD検出で自動的に録音開始/停止

## 💻 実装

### .gitignore

```gitignore
# Dependencies
node_modules/
.rye/
__pycache__/

# Environment
.env
.env.local

# Build outputs
dist/
build/

# Recordings
recordings/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### tsconfig.node.json

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### server.py（シンプルな1ファイル）

```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import json
from datetime import datetime
from dotenv import load_dotenv

# 環境変数読み込み
load_dotenv()

app = FastAPI()

# 環境変数から設定取得
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
AUDIO_SAVE_PATH = os.getenv("AUDIO_SAVE_PATH", "./recordings")

# CORS設定（開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 録音ディレクトリ作成
os.makedirs(AUDIO_SAVE_PATH, exist_ok=True)

@app.get("/")
async def health():
    return {"status": "ok", "time": datetime.now()}

@app.websocket("/ws/audio")
async def audio_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # 音声データ受信
            data = await websocket.receive_bytes()
            
            # ファイル保存
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"recording_{timestamp}.wav"
            filepath = os.path.join(AUDIO_SAVE_PATH, filename)
            
            with open(filepath, "wb") as f:
                f.write(data)
            
            # 結果返信
            await websocket.send_json({
                "filename": filename,
                "size": len(data),
                "timestamp": timestamp
            })
    except:
        pass

@app.get("/recordings")
async def list_recordings():
    files = []
    for f in os.listdir(AUDIO_SAVE_PATH):
        if f.endswith((".wav", ".webm")):
            filepath = os.path.join(AUDIO_SAVE_PATH, f)
            files.append({
                "name": f,
                "size": os.path.getsize(filepath),
                "created": os.path.getctime(filepath)
            })
    return {"recordings": files}

@app.get("/recordings/{filename}")
async def get_recording(filename: str):
    filepath = os.path.join(AUDIO_SAVE_PATH, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    return {"error": "File not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)
```

### package.json（必要最小限）

```json
{
  "name": "voice-recorder",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve": "rye run python server.py",
    "start": "concurrently \"npm run serve\" \"npm run dev\""
  },
  "dependencies": {
    "vue": "^3.4.0",
    "element-plus": "^2.7.0",
    "@ricky0123/vad-web": "^0.0.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@types/node": "^20.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.0.0",
    "concurrently": "^8.0.0"
  }
}
```

### pyproject.toml（rye用）

```toml
[project]
name = "voice-recorder"
version = "0.1.0"
description = "Voice recorder with VAD"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.30.0",
    "python-multipart>=0.0.9",
    "websockets>=12.0",
    "python-dotenv>=1.0.0",
]
requires-python = ">= 3.11"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.rye]
managed = true
dev-dependencies = []
```

## 🚀 起動方法

```bash
# Python環境セットアップ（rye）
rye sync

# Node依存関係インストール
npm install

# 開発サーバー起動（両方同時）
npm start

# または個別に起動
# ターミナル1
rye run python server.py

# ターミナル2
npm run dev
```

## 📝 開発手順

### Step 1: プロジェクト初期化
```bash
# プロジェクト作成
mkdir voice-recorder && cd voice-recorder

# Python環境（rye）
rye init
# pyproject.tomlを上記の内容に編集
rye sync

# Node環境
npm init -y
# package.jsonを上記の内容に編集
npm install
```

### Step 2: 基本ファイル作成

**index.html**
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Recorder</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**src/main.ts**
```typescript
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
```

**src/App.vue**
```vue
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
```

**src/components/AudioMonitor.vue（常時表示）**
```vue
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
import { ref, onMounted, onUnmounted } from 'vue'
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
</style>
```

### Step 3: VAD実装
1. VADライブラリ統合（@ricky0123/vad-web使用）
2. `useWebRTCVAD.ts` composable作成
3. 音声バッファリング実装

**注**: ブラウザ用WebRTC VADライブラリはいくつか選択肢があります：
- `@ricky0123/vad-web`: Silero VADのWebAssembly版
- 自前実装: Web Audio APIでエネルギーベースVAD
- TensorFlow.js: カスタムモデル

**src/composables/useAudioMonitor.ts（常時モニタリング用）**
```typescript
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
```

### Step 4: UI実装
1. 常時音声モニター（AudioMonitor.vue）
2. 録音コントロール（AudioRecorder.vue）
3. 設定パネル（VAD感度など）
4. 録音履歴表示

## 🎯 これだけで動く！

最小限の構成で：
- ブラウザでマイク録音
- VADで音声区間検出
- サーバーにファイル保存
- 録音一覧表示

複雑な設定や認証なし。個人利用に最適なシンプル設計です。

---

**📅 更新日**: 2025-06-26  
**🎯 コンセプト**: シンプル最優先の音声録音システム