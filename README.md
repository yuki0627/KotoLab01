# 音声録音システム（VAD機能付き）

ブラウザ側でVAD（Voice Activity Detection）処理を行う軽量な音声録音システムです。
話している時だけ自動で録音し、無音部分はカットして効率的に保存できます。

## 🎯 主要機能

- **リアルタイム音声モニタリング**: 常時マイクから音声レベルを監視
- **音量メーター**: dB表示とプログレスバーで音量を可視化
- **VAD（音声検出）**: 話している時と無音時を自動判別
- **波形表示**: リアルタイムで音声波形を描画
- **手動録音**: ボタンで録音開始/停止
- **自動録音**: VAD検出で自動的に録音開始/停止（未実装）
- **録音履歴**: 保存された録音ファイルの一覧・再生

## 🚀 クイックスタート

### 1. 依存関係のインストール

```bash
# Node.js依存関係
npm install

# Python依存関係（rye使用）
rye sync
```

**注意**: Python 3.10以上が必要です。ryeがない場合は以下でインストール:
```bash
# ryeのインストール（macOS/Linux）
curl -sSf https://rye.astral.sh/get | bash

# 手動でPython依存関係をインストールする場合
pip install fastapi uvicorn python-multipart websockets python-dotenv
```

### 2. サーバー起動

```bash
# FastAPIサーバーを起動
rye run python server.py

# または直接実行
python server.py
```

### 3. フロントエンド起動

```bash
# 開発サーバーを起動（別ターミナル）
npm run dev
```

### 4. アクセス

ブラウザで `http://localhost:5173` にアクセス

## 📱 使い方

### 初回アクセス時
1. ブラウザがマイクアクセス許可を求めるので **「許可」** をクリック
2. 音量メーターと波形表示が動き始めます

### 音声モニタリング
- **音量レベル**: リアルタイムでdB値とプログレスバーが更新
- **VAD状態**: 音声検出中は緑の点が点滅、無音時は灰色
- **波形表示**: 音声波形がリアルタイムで描画（音声検出中は緑色）
- **環境ノイズ**: 起動1秒後に環境ノイズレベルを表示

### 録音機能
1. **「録音開始」** ボタンをクリック
2. 録音中は **「録音停止」** ボタンに変わり、録音時間が表示
3. **「録音停止」** で録音終了、自動的にサーバーに保存
4. 録音履歴テーブルに新しいファイルが表示

### 録音履歴
- **再生**: 録音ファイルをブラウザで直接再生
- **削除**: ファイル削除（未実装）
- **ファイル情報**: ファイル名、サイズ、作成日時を表示

## ⚙️ 設定

### 環境変数（.env）
```bash
# サーバー設定
API_HOST=127.0.0.1
API_PORT=8000

# フロントエンド設定
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_URL=ws://127.0.0.1:8000/ws

# 録音ファイル保存先
AUDIO_SAVE_PATH=./recordings
```

### VAD設定
現在はエネルギーベースの簡易VADを使用（閾値: -35dB）
設定変更は `src/composables/useAudioMonitor.ts:51` で調整可能

## 📁 ファイル構成

```
voice-recorder/
├── server.py              # FastAPIサーバー
├── package.json           # Node.js依存関係
├── index.html            # エントリーポイント
├── src/
│   ├── main.ts           # Vue.jsメイン
│   ├── App.vue           # メインコンポーネント
│   ├── components/
│   │   ├── AudioMonitor.vue    # 音声モニター
│   │   └── AudioRecorder.vue   # 録音機能
│   └── composables/
│       └── useAudioMonitor.ts  # 音声処理
└── recordings/           # 録音ファイル保存先
```

## 🔧 技術スタック

- **フロントエンド**: Vue 3 + TypeScript + Vite + Element Plus
- **バックエンド**: Python + FastAPI
- **音声処理**: Web Audio API
- **通信**: WebSocket
- **VAD**: エネルギーベース（将来的にWebRTC VADライブラリ対応予定）

## 📝 トラブルシューティング

### マイクアクセスが許可されない
- ブラウザの設定でマイクアクセスを許可
- HTTPSでないとマイクアクセスが制限される場合があります

### 録音ファイルが保存されない
- `recordings/` ディレクトリが存在することを確認
- サーバーが正常に起動していることを確認
- WebSocket接続エラーがないかコンソールを確認

### 音声が検出されない
- マイクの音量設定を確認
- VAD閾値が適切か確認（`useAudioMonitor.ts`の`-35`を調整）

## 📈 今後の拡張予定

- [ ] WebRTC VADライブラリの統合
- [ ] 自動録音機能の実装
- [ ] 録音ファイルの削除機能
- [ ] VAD感度の設定UI
- [ ] 録音形式の選択（WAV/WebM）
- [ ] 録音ファイルのダウンロード機能

---

## 💻 開発者向け情報

### 利用可能なコマンド

```bash
# フロントエンド
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run serve        # FastAPIサーバー起動（rye経由）
npm start            # サーバー + フロントエンド同時起動

# Python（rye使用）
rye sync             # 依存関係インストール
rye run python server.py  # サーバー起動
```

### プロジェクト管理

- **パッケージ管理**: Node.js (npm) + Python (rye)
- **開発サーバー**: Vite (Hot Reload対応)
- **ビルドツール**: Vite + TypeScript
- **型チェック**: TypeScript strict mode