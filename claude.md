# 音声録音システム開発プロジェクト（Vue VAD 実装版）

## 📋 プロジェクト概要

ブラウザ側でVAD（Voice Activity Detection）処理を行う軽量な音声録音システム。
話している時だけ自動で録音し、無音部分はカットして効率的に保存。

**実装完了度**: 基本機能は全て実装済み、実用レベルに到達。

## 🏗️ 技術スタック

- **フロントエンド**: Vue 3 + TypeScript + Vite + Element Plus
- **バックエンド**: Python + FastAPI + WebSocket
- **音声処理**: Web Audio API + エネルギーベースVAD
- **通信**: WebSocket（リアルタイム音声送信）
- **開発ツール**: rye（Python）+ npm（Node.js）

## 📁 実際のプロジェクト構成

```
vue-vad01/
├── .env                         # 環境変数設定
├── .gitignore                   # Git除外設定
├── README.md                    # プロジェクト説明書
├── CLAUDE.md                    # このファイル（開発仕様書）
├── package.json                 # Node.js依存関係・スクリプト
├── pyproject.toml               # Python依存関係（rye管理）
├── index.html                   # Viteエントリーポイント
├── vite.config.ts               # Vite設定（プロキシ含む）
├── tsconfig.json                # TypeScript設定
├── tsconfig.node.json           # TypeScript（Node.js用）
├── server.py                    # FastAPIサーバー（1ファイル完結）
├── src/                         # Vueアプリケーション
│   ├── main.ts                  # Vue.js初期化
│   ├── App.vue                  # メインコンポーネント
│   ├── components/              # Vueコンポーネント
│   │   ├── AudioMonitor.vue     # 音声モニタリング（常時ON）
│   │   ├── AudioRecorder.vue    # 録音制御（手動・自動）
│   │   └── RecordingHistory.vue # 録音履歴管理
│   └── composables/             # ビジネスロジック
│       ├── useAudioMonitor.ts   # 音声解析・VAD処理
│       └── useAudioDevices.ts   # マイクデバイス管理
├── recordings/                  # 録音ファイル保存先
└── dist/                        # ビルド出力先
```

## ⚙️ 環境設定（.env）

```bash
# サーバー設定
API_HOST=127.0.0.1
API_PORT=8000

# フロントエンド設定（VITE_プレフィックス必須）
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws

# 音声ファイル保存設定
AUDIO_SAVE_PATH=./recordings
DEBUG=true
```

## 🔧 実装済み主要機能

### 1. 常時音声モニタリング（AudioMonitor.vue）
- ✅ **録音していない時も常にマイクON**
- ✅ **リアルタイム音量メーター**（dB表示 + プログレスバー）
- ✅ **VAD状態表示**（音声検出中は緑の点滅、無音は灰色）
- ✅ **音声波形のリアルタイム表示**（Canvas描画）
- ✅ **環境ノイズレベル計測**（起動時に測定）
- ✅ **マイクデバイス選択**（複数デバイス対応）
- ✅ **VAD閾値調整**（-60dB〜-10dB、リアルタイム調整）

### 2. 録音機能（AudioRecorder.vue）
- ✅ **手動録音モード**（ボタンで開始/停止）
- ✅ **自動録音モード**（VAD検出で自動録音開始/停止）
- ✅ **タブ型UI**（手動・自動録音の切り替え）
- ✅ **無音時間設定**（1秒〜5分、デフォルト5秒）
- ✅ **録音時間表示**（リアルタイムカウンター）
- ✅ **WebSocket通信**（リアルタイム音声データ送信）
- ✅ **リソース管理**（録音停止時の適切なクリーンアップ）

### 3. 録音履歴機能（RecordingHistory.vue）
- ✅ **録音ファイル一覧表示**（新しい順でソート）
- ✅ **ファイル再生機能**（HTML5 Audio）
- ✅ **ファイル削除機能**（確認ダイアログ付き）
- ✅ **ファイル情報表示**（ファイル名、サイズ、作成日時）
- ✅ **自動更新機能**（録音完了時に履歴更新）

### 4. サーバーサイド（server.py）
- ✅ **WebSocket音声受信**（/ws/audio エンドポイント）
- ✅ **録音ファイル保存**（タイムスタンプベースのファイル名）
- ✅ **REST API**（ファイル一覧取得・配信・削除）
- ✅ **CORS設定**（開発環境対応）

## 🎯 VAD実装の詳細

### 現在の実装: エネルギーベースVAD
```typescript
// useAudioMonitor.ts の実装
interface VadSettings {
  threshold: number;        // 閾値（dB）デフォルト: -35dB
  adjustableRange: {        // 調整可能範囲
    min: -60;              // 最小: -60dB（高感度）
    max: -10;              // 最大: -10dB（低感度）
  };
  algorithm: 'energy';      // エネルギーベース
}

// 音量計算（RMS → dB変換）
function calculateVolume(audioData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i];
  }
  const rms = Math.sqrt(sum / audioData.length);
  return 20 * Math.log10(rms);
}

// VAD判定
function detectVoiceActivity(volumeDb: number, threshold: number): boolean {
  return volumeDb > threshold;
}
```

### 将来の拡張予定: WebRTC VADライブラリ
```typescript
// @ricky0123/vad-web の統合予定
interface WebRTCVadSettings {
  algorithm: 'webrtc' | 'silero';
  sensitivity: 0 | 1 | 2 | 3;  // WebRTC VAD Mode
  timing: {
    speechPadStart: number;     // 音声前の余白 (ms)
    speechPadEnd: number;       // 音声後の余白 (ms)
    minSpeechDuration: number;  // 最小音声長 (ms)
    maxSilenceDuration: number; // 最大無音長 (ms)
  };
}
```

## 📊 無音時間設定の実装

### 設定仕様
- **デフォルト値**: 5秒
- **最小値**: 1秒
- **最大値**: 5分（300秒）
- **調整単位**: 1秒刻み
- **表示形式**: 1分未満「○秒」、1分以上「○分○秒」

### UI実装（AudioRecorder.vue）
```vue
<template>
  <div class="silence-duration-setting">
    <label>録音停止までの無音時間: {{ formatDuration(silenceDuration) }}</label>
    <el-slider
      v-model="silenceDuration"
      :min="1"
      :max="300"
      :step="1"
      :marks="silenceDurationMarks"
      @change="onSilenceDurationChange"
    />
  </div>
</template>

<script setup lang="ts">
// スライダーマーク
const silenceDurationMarks = {
  '1': '1秒',
  '30': '30秒',
  '60': '1分',
  '120': '2分',
  '300': '5分'
}

// 時間フォーマット関数
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (remainingSeconds === 0) {
      return `${minutes}分`
    } else {
      return `${minutes}分${remainingSeconds}秒`
    }
  }
}
</script>
```

## 🔄 処理フロー

### 常時モニタリングフロー
```
[起動時]
マイクアクセス許可 → Audio Context初期化 → モニタリング開始

[モニタリングループ]
マイク音声 → Web Audio API → リアルタイム解析
                           ├─ 音量計算（RMS→dB） → メーター表示
                           ├─ VAD処理（閾値判定） → 状態表示
                           ├─ 波形データ取得 → Canvas描画
                           └─ デバイス切り替え対応
```

### 自動録音フロー
```
[自動録音モード]
「自動録音開始」→ VAD監視開始
                ↓
              音声検出 → 録音開始 → WebSocket送信開始
                ↓
              無音検出 → タイマー開始（設定秒数）
                ↓
              タイマー満了 → 録音停止 → ファイル保存 → 履歴更新
                ↓
              再び音声検出待機
```

## 💻 実装済みコンポーネント詳細

### AudioMonitor.vue（音声モニター）
```typescript
// 主要機能
- リアルタイム音量表示（dBとパーセンテージ）
- VAD状態インジケーター（点滅アニメーション）
- 波形可視化（Canvas + 色変化）
- マイクデバイス選択ドロップダウン
- VAD閾値調整スライダー
- 録音状態表示

// 使用composable
- useAudioMonitor（音声解析）
- useAudioDevices（デバイス管理）
```

### AudioRecorder.vue（録音制御）
```typescript
// 主要機能
- タブ型UI（手動録音・自動録音）
- MediaRecorder API統合
- WebSocket通信
- 録音時間カウンター
- 無音時間設定UI
- 状態管理（録音中・待機中・エラー）

// 録音形式
- 出力形式: WebM
- サンプルレート: 16000Hz
- エンコーディング: ブラウザ依存
```

### RecordingHistory.vue（録音履歴）
```typescript
// 主要機能
- REST API連携（GET /recordings）
- ファイル再生（HTML5 Audio API）
- ファイル削除（DELETE /recordings/{filename}）
- 一覧表示（Element Plus Table）
- 自動更新（録音完了時）

// 表示情報
- ファイル名、サイズ、作成日時
- 再生・停止・削除ボタン
- ロード状態表示
```

## 🚀 起動・開発方法

### 推奨起動方法（同時起動）
```bash
# 依存関係インストール
npm install
rye sync

# サーバー + フロントエンド同時起動
npm start
```

### 個別起動方法
```bash
# ターミナル1: FastAPIサーバー
rye run python server.py

# ターミナル2: Vite開発サーバー
npm run dev
```

### 利用可能なスクリプト
```json
{
  "scripts": {
    "dev": "vite",                      // フロントエンド開発サーバー
    "build": "vite build",              // プロダクションビルド
    "serve": "rye run python server.py", // サーバー単体起動
    "start": "concurrently \"npm run serve\" \"npm run dev\"" // 同時起動
  }
}
```

## 📝 今後の拡張計画

### Phase 1: VAD機能強化
- [ ] WebRTC VADライブラリ（@ricky0123/vad-web）の本格統合
- [ ] 複数VADアルゴリズムの選択機能
- [ ] VAD感度の詳細設定UI

### Phase 2: 音声処理強化
- [ ] 録音形式選択（WAV/WebM/MP3）
- [ ] 音質設定（サンプルレート、ビットレート）
- [ ] 音声前処理（ノイズ除去、音量正規化）

### Phase 3: UI/UX改善
- [ ] 録音ファイルのダウンロード機能
- [ ] 複数ファイルの一括操作
- [ ] 録音スケジュール機能
- [ ] キーボードショートカット

### Phase 4: システム強化
- [ ] WebSocket自動再接続機能
- [ ] 録音データの圧縮
- [ ] ファイル形式変換機能
- [ ] 録音データの統計表示

## 🔧 技術的実装ポイント

### Web Audio API活用
```typescript
// 高品質音声解析の実装
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;                    // 高解像度FFT
analyser.smoothingTimeConstant = 0.8;       // スムージング
```

### MediaRecorder API設定
```typescript
// 最適な録音設定
const constraints = {
  audio: {
    echoCancellation: true,    // エコーキャンセレーション
    noiseSuppression: true,    // ノイズ抑制
    autoGainControl: false,    // 自動ゲイン制御OFF
    sampleRate: 16000,         // サンプルレート
  }
};
```

### WebSocket通信最適化
```typescript
// 効率的なバイナリデータ送信
websocket.send(audioBlob.arrayBuffer());

// サーバーサイドでの適切な処理
@app.websocket("/ws/audio")
async def audio_ws(websocket: WebSocket):
    await websocket.accept()
    data = await websocket.receive_bytes()
    # ファイル保存処理
```

## 🎯 プロジェクトの完成度

### ✅ 完全実装済み（Production Ready）
- 基本的な音声録音・再生・削除機能
- リアルタイム音声モニタリング
- 手動・自動録音制御
- WebSocket音声通信
- 録音履歴管理
- デバイス選択機能
- VAD閾値調整機能
- 無音時間設定機能

### ⚠️ 実装済み（改善の余地あり）
- エネルギーベースVAD（WebRTC VAD未使用）
- 基本的なエラーハンドリング
- 簡易的なノイズフロア計算

### 🎯 総合評価
**実用レベル到達**: 個人・小規模利用には十分な機能と品質。
企業利用には追加のセキュリティとエラーハンドリングが必要。

---

**📅 最終更新日**: 2024-12-29
**🎯 プロジェクト状態**: 基本機能完成・実用レベル到達
**💡 コンセプト**: シンプルで高品質な音声録音システム