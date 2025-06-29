from fastapi import FastAPI, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import json
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
import threading
from pathlib import Path

# 環境変数読み込み
load_dotenv()

app = FastAPI()

# 環境変数から設定取得
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))
AUDIO_SAVE_PATH = os.getenv("AUDIO_SAVE_PATH", "./recordings")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-1")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "ja")

# CORS設定（開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 録音ディレクトリ作成
os.makedirs(AUDIO_SAVE_PATH, exist_ok=True)

# OpenAI クライアント初期化
openai_client = None
if OPENAI_API_KEY and OPENAI_API_KEY != "your_openai_api_key_here":
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    print("OpenAI Whisper API が初期化されました")
else:
    print("OpenAI API キーが設定されていません。転写機能は無効です。")

# 転写状態管理
transcription_status = {}  # ファイル名: {"status": "pending/processing/completed/failed", "text": "", "error": ""}
transcription_queue = asyncio.Queue()

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
            
            # 転写処理をキューに追加
            if openai_client:
                await queue_transcription(filename, filepath)
    except:
        pass

@app.get("/recordings")
async def list_recordings():
    files = []
    for f in os.listdir(AUDIO_SAVE_PATH):
        if f.endswith((".wav", ".webm")):
            filepath = os.path.join(AUDIO_SAVE_PATH, f)
            
            # 転写ファイルの存在確認
            txt_filename = f.rsplit('.', 1)[0] + '.txt'
            txt_filepath = os.path.join(AUDIO_SAVE_PATH, txt_filename)
            has_transcription = os.path.exists(txt_filepath)
            
            # 転写状態の確認
            transcription_info = transcription_status.get(f, {"status": "not_started"})
            
            files.append({
                "name": f,
                "size": os.path.getsize(filepath),
                "created": os.path.getctime(filepath),
                "has_transcription": has_transcription,
                "transcription_status": transcription_info.get("status", "not_started"),
                "transcription_error": transcription_info.get("error", "")
            })
    return {"recordings": files}

@app.get("/recordings/{filename}")
async def get_recording(filename: str):
    filepath = os.path.join(AUDIO_SAVE_PATH, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    return {"error": "File not found"}

@app.get("/recordings/{filename}/transcription")
async def get_transcription(filename: str):
    # .wav/.webm ファイル名から .txt ファイル名を生成
    base_filename = filename.rsplit('.', 1)[0]
    txt_filename = base_filename + '.txt'
    txt_filepath = os.path.join(AUDIO_SAVE_PATH, txt_filename)
    
    if os.path.exists(txt_filepath):
        with open(txt_filepath, 'r', encoding='utf-8') as f:
            text_content = f.read()
        return {
            "filename": txt_filename,
            "text": text_content,
            "status": "completed"
        }
    
    # 転写状態を確認
    status_info = transcription_status.get(filename, {"status": "not_started"})
    return {
        "filename": txt_filename,
        "text": "",
        "status": status_info.get("status", "not_started"),
        "error": status_info.get("error", "")
    }

@app.delete("/recordings/{filename}")
async def delete_recording(filename: str):
    filepath = os.path.join(AUDIO_SAVE_PATH, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            
            # 対応する転写ファイルも削除
            base_filename = filename.rsplit('.', 1)[0]
            txt_filename = base_filename + '.txt'
            txt_filepath = os.path.join(AUDIO_SAVE_PATH, txt_filename)
            if os.path.exists(txt_filepath):
                os.remove(txt_filepath)
            
            # 転写状態からも削除
            if filename in transcription_status:
                del transcription_status[filename]
                
            return {"message": "File deleted successfully", "filename": filename}
        except Exception as e:
            return {"error": f"Failed to delete file: {str(e)}"}
    return {"error": "File not found"}

# 転写関連の関数

async def queue_transcription(filename: str, filepath: str):
    """転写処理をキューに追加"""
    if not openai_client:
        return
    
    transcription_status[filename] = {"status": "pending", "text": "", "error": ""}
    await transcription_queue.put((filename, filepath))
    print(f"転写キューに追加: {filename}")

async def process_transcription_queue():
    """転写キューを処理する背景タスク"""
    while True:
        try:
            filename, filepath = await transcription_queue.get()
            await transcribe_audio_file(filename, filepath)
            transcription_queue.task_done()
        except Exception as e:
            print(f"転写キュー処理エラー: {e}")
            await asyncio.sleep(1)

async def transcribe_audio_file(filename: str, filepath: str):
    """音声ファイルを転写"""
    if not openai_client:
        transcription_status[filename] = {"status": "failed", "text": "", "error": "OpenAI APIが利用できません"}
        return
    
    try:
        print(f"転写開始: {filename}")
        transcription_status[filename]["status"] = "processing"
        
        # OpenAI Whisper APIを呼び出し
        with open(filepath, "rb") as audio_file:
            response = openai_client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=audio_file,
                language=WHISPER_LANGUAGE,
                response_format="text"
            )
        
        # 転写結果をテキストファイルに保存
        base_filename = filename.rsplit('.', 1)[0]
        txt_filename = base_filename + '.txt'
        txt_filepath = os.path.join(AUDIO_SAVE_PATH, txt_filename)
        
        with open(txt_filepath, 'w', encoding='utf-8') as f:
            f.write(response)
        
        transcription_status[filename] = {"status": "completed", "text": response, "error": ""}
        print(f"転写完了: {filename} -> {txt_filename}")
        
    except Exception as e:
        error_msg = f"転写エラー: {str(e)}"
        transcription_status[filename] = {"status": "failed", "text": "", "error": error_msg}
        print(error_msg)

# アプリケーション起動時の処理
@app.on_event("startup")
async def startup_event():
    if openai_client:
        # 転写処理の背景タスクを開始
        asyncio.create_task(process_transcription_queue())
        print("転写処理の背景タスクを開始しました")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)