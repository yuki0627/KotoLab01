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

@app.delete("/recordings/{filename}")
async def delete_recording(filename: str):
    filepath = os.path.join(AUDIO_SAVE_PATH, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return {"message": "File deleted successfully", "filename": filename}
        except Exception as e:
            return {"error": f"Failed to delete file: {str(e)}"}
    return {"error": "File not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)