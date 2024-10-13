import os
from typing import List
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sglang as sgl
from dotenv import load_dotenv
import traceback
import logging
from pathlib import Path
from typing import Dict
import json
# log
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# find env file from root
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
dotenv_path = parent_dir / '.env.local'

# load it
if not dotenv_path.exists():
    logger.error(f"not .env.local file in: {dotenv_path}")
    raise FileNotFoundError(f"cannot find .env.local in : {dotenv_path}")

load_dotenv(dotenv_path=dotenv_path)

data_folder = parent_dir / 'data'
if not data_folder.exists():
    data_folder.mkdir()
    logger.info(f"创建 data 文件夹：{data_folder}")
app = FastAPI()
origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]



app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# def models
models = {
    'gpt-4': {
        'model_name': 'gpt-4o',
        'max_tokens': 150,
        'temperature': 0.7,
    },
    'gpt-3.5-turbo': {
        'model_name': 'gpt-3.5-turbo',
        'max_tokens': 150,
        'temperature': 0.7,
    },
    'gpt-4o-mini': { 
        'model_name': 'gpt-4o-mini',
        'max_tokens': 150,
        'temperature': 0.7,
    },
    # the model in hard code rn, but will be changed later since the model was defed in frontend
}

# set openai apikey
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("set your api key in .env.local OPENAI_API_KEY。")
    raise RuntimeError("set your OPENAI_API_KEY。")

# sglang backend in default
sgl.set_default_backend(sgl.OpenAI(api_key=openai_api_key, model_name="gpt-4"))

# def messege model
class Message(BaseModel):
    role: str
    content: str

# def config model
class Configuration(BaseModel):
    model: str  
    max_tokens: int
    temperature: float = 0.7

# def req mode
class ChatRequest(BaseModel):
    messages: List[Message]  
    configuration: Configuration  
class ThreadData(BaseModel):
    threadId: str
    thread: Dict
# resp model
class ChatResponse(BaseModel):
    response: str

# sglang multi turn
@sgl.function
def multi_turn_question(s, messages: List[Message], model: str, max_tokens: int,temperature: float):
 
    s += sgl.system("You are a helpful assistant.")
    
    # interate all messages from different roles
    for msg in messages:
        if msg.role == "system":
            s += sgl.system(msg.content)
        elif msg.role == "user":
            s += sgl.user(msg.content)
        elif msg.role == "assistant":
            s += sgl.assistant(msg.content)
    
    # gen response
    s += sgl.assistant(sgl.gen("response", max_tokens=max_tokens, temperature=temperature))


@app.get("/api/connect")
async def connect():
    logger.info("connected!。")
    return JSONResponse(content={"message": "successful"}, status_code=200)

@app.post("/api/save_thread")
async def save_thread(thread_data: ThreadData):
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread

        thread_file = data_folder / f"{thread_id}.json"
        with thread_file.open("w", encoding="utf-8") as f:
            json.dump(thread, f, ensure_ascii=False, indent=4)
        logger.info(f"成功保存线程 {thread_id} 数据。")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"保存线程数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail="保存线程数据失败")

# load threads
@app.get("/api/load_threads")
async def load_threads():
    try:
        threads = []
        for thread_file in data_folder.glob("*.json"):
        
            if thread_file.name == "models.json":
                continue
            with thread_file.open("r", encoding="utf-8") as f:
                thread = json.load(f)
                threads.append(thread)
        logger.info(f"成功加载 {len(threads)} 个线程。")
        return {"threads": threads}
    except Exception as e:
        logger.error(f"加载线程数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail="加载线程数据失败")
    
@app.get("/api/models", response_model=List[Configuration])
async def get_models():
    logger.info("backend:get modellist。")
    return [
        Configuration(
            model=key,
            max_tokens=value['max_tokens']
        )
        for key, value in models.items()
    ]

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, req: Request):
    try:
        # read and print req body
        body = await req.body()
        logger.info("recv raw data:")
        logger.info(body.decode('utf-8'))

        logger.info("recv req:")
        logger.info(request.json())

        logger.info(f"Received model ID from req: {request.configuration.model}")
        logger.info(f"Available models those def above: {list(models.keys())}")

        if request.configuration.model not in models:
            logger.error("Invalid model ID received.")
            raise HTTPException(status_code=400, detail="Invalid model ID")

        response = multi_turn_question.run(
            request.messages,
            request.configuration.model,
            request.configuration.max_tokens,
            request.configuration.temperature
        )

        # print resp
        logger.info("resp:")
        logger.info(response["response"])

        return ChatResponse(response=response["response"])

    except HTTPException as he:
        logger.error(f"HTTPException: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"error msg：{str(e)}")
        traceback.print_exc()  # print all
        raise HTTPException(status_code=500, detail="error from backend")

# run backend
if __name__ == "__main__":
    logger.info("start FastAPI server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    logger.info("Loaded API Key:", openai_api_key)
    print("Allowed origins:", allowed_origins)

