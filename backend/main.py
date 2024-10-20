import json
import logging
import os
import traceback
import uvicorn
from pathlib import Path
from typing import Dict, List, Union,Optional
from pymongo import MongoClient
import sglang as sgl
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import urllib.parse
from pymongo.server_api import ServerApi
# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up environment and data directory
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
dotenv_path = parent_dir / ".env.local"

if not dotenv_path.exists():
    logger.error(f"Missing .env.local file: {dotenv_path}")
    raise FileNotFoundError(f".env.local not found at this path: {dotenv_path}")

load_dotenv(dotenv_path=dotenv_path)
username = os.getenv("MONGO_USERNAME")
password = os.getenv("MONGO_PASSWORD")
encoded_username = urllib.parse.quote_plus(username)
encoded_password = urllib.parse.quote_plus(password)
mongo_url =f"mongodb+srv://{encoded_username}:{encoded_password}@cluster0.wxzms.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

client = MongoClient(mongo_url, server_api=ServerApi('1'))
# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

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


openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
if not openrouter_api_key:
    logger.error("Please set OPENROUTER_API_KEY in .env.local.")
    raise RuntimeError("Missing OPENROUTER_API_KEY.")

backend = sgl.OpenAI(
    model_name="gpt-3.5-turbo",
    base_url="https://openrouter.ai/api/v1",
    api_key=openrouter_api_key,
)
sgl.set_default_backend(backend)


class Message(BaseModel):
    role: str
    content: str


class Configuration(BaseModel):
    model: str
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    top_k: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    logit_bias: Optional[Dict[str, float]] = None
    top_a: Optional[float] = None
    seed: Optional[int] = None
    context_length: Optional[int] = None
    min_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    logprobs: Optional[int] = None
    top_logprobs: Optional[int] = None
    response_format: Optional[Dict] = None
    tools: Optional[List] = None
    tool_choice: Optional[Union[str, Dict]] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    configuration: Configuration


class ThreadData(BaseModel):
    threadId: str
    thread: Dict


class ChatResponse(BaseModel):
    response: str


class Model(BaseModel):
    id: str
    name: str
    baseModel: str
    systemPrompt: str
    parameters: Configuration


@sgl.function
def multi_turn_question(
    s, messages: List[Message], config: Configuration
):
    # Set the model configuration
    s.model = config.model
  
    # Check and set each configuration parameter only if it exists in the config
    if config.temperature is not None:
        s.temperature = config.temperature

    if config.max_tokens is not None:
        s.max_tokens = config.max_tokens

    if config.top_p is not None:
        s.top_p = config.top_p

    if config.frequency_penalty is not None:
        s.frequency_penalty = config.frequency_penalty

    if config.presence_penalty is not None:
        s.presence_penalty = config.presence_penalty

    if config.repetition_penalty is not None:
        s.repetition_penalty = config.repetition_penalty

    if config.min_p is not None:
        s.min_p = config.min_p

    if config.top_a is not None:
        s.top_a = config.top_a

    if config.seed is not None:
        s.seed = config.seed

    if config.context_length is not None:
        s.context_length = config.context_length

    if config.top_k is not None:
        s.top_k = config.top_k

    if config.logit_bias is not None:
        s.logit_bias = config.logit_bias

    if config.logprobs is not None:
        s.logprobs = config.logprobs

    if config.top_logprobs is not None:
        s.top_logprobs = config.top_logprobs

    if config.response_format is not None:
        s.response_format = config.response_format

    if config.stop is not None:
        s.stop = config.stop

    if config.tools is not None:
        s.tools = config.tools

    if config.tool_choice is not None:
        s.tool_choice = config.tool_choice
    # Process messages
    for msg in messages:
        if msg.role == "system":
            s += sgl.system(msg.content)
        elif msg.role == "user":
            s += sgl.user(msg.content)
        elif msg.role == "assistant":
            s += sgl.assistant(msg.content)
    s += sgl.assistant(sgl.gen("response"))


models_list = []

def load_models_from_file():
    global models_list
    try:
        
        if models_file.exists():
            logger.info("models.json file found. Attempting to load models.")
            with models_file.open("r", encoding="utf-8") as f:
                try:
                    models_list = json.load(f)
                    if not models_list:
                        logger.warning("models.json is empty. Initializing with default models.")
                        models_list = get_default_models()
                    else:
                        logger.info(f"Successfully loaded models: {models_list}")
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse models.json: {e}. Initializing with default models.")
                    models_list = get_default_models()
        else:
           
            logger.warning("models.json file not found. Initializing with default models.")
            models_list = get_default_models()
    except Exception as e:
        logger.error(f"Failed to load models due to an unexpected error: {str(e)}")
        models_list = get_default_models()


def get_default_models():
    """Return default model configuration."""
    return [
        {
            "id": "1",
            "name": "Default Model",
            "baseModel": "openai/gpt-4o-2024-08-06",
            "systemPrompt": "You are a helpful assistant.",
            "parameters": ({
                "temperature": 0.7,
                "max_tokens": 512,
               
            })
        }
    ]



@app.get("/api/connect")
async def connect():
    logger.info("Connected to backend.")
    return JSONResponse(content={"message": "successful"}, status_code=200)


""" @app.post("/api/save_thread")
async def save_thread(thread_data: ThreadData):
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread

        thread_file = data_folder / f"{thread_id}.json"
        with thread_file.open("w", encoding="utf-8") as f:
            json.dump(thread, f, ensure_ascii=False, indent=4)
        logger.info(f"Successfully saved thread {thread_id}.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save thread: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save thread") """
        
@app.post("/api/save_thread")
async def save_thread(thread_data: ThreadData):
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread
        
        
        db = client["threaddata"] 
        collection_name = f"thread_{thread_id}" 
        collection = db[collection_name]
        
       
        result = collection.update_one(
            {"threadId": thread_id},
            {"$set": thread},
            upsert=True  
        )
        
        logger.info(f"Successfully saved thread {thread_id} to collection {collection_name}.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save thread to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save thread")



""" @app.get("/api/load_threads")
async def load_threads():
    try:
        threads = []
        for thread_file in data_folder.glob("*.json"):
            if thread_file.name == "models.json":
                continue
            with thread_file.open("r", encoding="utf-8") as f:
                thread = json.load(f)
                threads.append(thread)
        logger.info(f"Successfully loaded {len(threads)} threads.")
        return {"threads": threads}
    except Exception as e:
        logger.error(f"Failed to load threads: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load threads")
 """

@app.get("/api/load_threads")
async def load_threads():
    try:
        db = client["threaddata"]
        collections = db.list_collection_names() 
        
        threads = []
        for collection_name in collections:
            if collection_name.startswith("thread_"):
                collection = db[collection_name]
                thread = collection.find_one({}, {"_id": 0}) 
                if thread:
                    threads.append(thread)

        logger.info(f"Successfully loaded {len(threads)} threads from MongoDB.")
        return {"threads": threads}
    except Exception as e:
        logger.error(f"Failed to load threads from MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load threads")


""" @app.delete("/api/delete_thread/{thread_id}")
async def delete_thread(thread_id: str):
    try:
        thread_file = data_folder / f"{thread_id}.json"
        if thread_file.exists():
            thread_file.unlink()
            logger.info(f"Successfully deleted thread {thread_id}.")
            return {
                "status": "success",
                "message": f"Thread {thread_id} has been deleted",
            }
        else:
            logger.error(f"Thread {thread_id} does not exist.")
            raise HTTPException(status_code=404, detail="Thread not found")
    except Exception as e:
        logger.error(f"Failed to delete thread: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete thread")
 """
@app.delete("/api/delete_thread/{thread_id}")
async def delete_thread(thread_id: str):
    try:
        db = client["threaddata"] 
        collection_name = f"thread_{thread_id}"
        
       
        if collection_name in db.list_collection_names():
            db.drop_collection(collection_name)
            logger.info(f"Successfully deleted thread {thread_id} (collection {collection_name}).")
            return {
                "status": "success",
                "message": f"Thread {thread_id} (collection {collection_name}) has been deleted",
            }
        else:
            logger.error(f"Thread {thread_id} does not exist.")
            raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found")
    except Exception as e:
        logger.error(f"Failed to delete thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete thread")

@app.get("/api/load_models")
async def load_models():
    try:
        db = client["threaddata"]  # 连接到 MongoDB 数据库
        collection = db["models"]  # 使用 "models" 集合
        
        # 从 MongoDB 中获取所有模型
        models_from_db = list(collection.find({}, {"_id": 0}))  # 获取模型时排除 `_id` 字段
        
        if not models_from_db:
            logger.warning("No models found in the database. Attempting to load from file.")
            load_models_from_file()  # 如果数据库中没有模型，则尝试从文件加载
            if not models_list:
                logger.warning("No models found in file either. Initializing with default models.")
                models_list = get_default_models()  # 如果文件中也没有模型，则返回默认模型
        else:
            logger.info(f"Successfully loaded {len(models_from_db)} models from MongoDB.")
            models_list = models_from_db  # 从数据库加载的模型

        return {"models": models_list}
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load models from database or file")

@app.post("/api/add_model")
async def add_model(model: Model):
    try:
        db = client["threaddata"]
        collection = db["models"]
        
        # 检查是否已经存在相同 ID 的模型
        existing_model = collection.find_one({"id": model.id})
        if existing_model:
            raise HTTPException(status_code=400, detail="Model with this ID already exists")
        
        # 将模型插入数据库
        collection.insert_one(model.dict())  # 将 Pydantic 模型转换为字典并插入
        logger.info(f"Model {model.id} successfully added to MongoDB.")
        return {"status": "success", "message": f"Model {model.name} added successfully."}
    
    except Exception as e:
        logger.error(f"Failed to add model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add model")

""" @app.post("/api/save_models")
async def save_models(request: Request):
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided")

        models_file = data_folder / "models.json"
        with models_file.open("w", encoding="utf-8") as f:
            json.dump(models, f, ensure_ascii=False, indent=4)
        logger.info(f"Models successfully saved.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save models")
 """

@app.post("/api/save_models")
async def save_models(request: Request):
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided")
        
        # 连接 MongoDB 的 collection，用于保存模型数据
        db = client["threaddata"]  
        collection = db["models"]  
        
        for model in models:
            # 打印原始数据
            logger.info(f"Original model data before filtering: {model}")
            
            # 过滤掉模型中值为 None 或 undefined 的字段
            filtered_model = {k: v for k, v in model.items() if v is not None}
            
            # 打印过滤后的数据
            logger.info(f"Filtered model data before saving: {filtered_model}")
            
            # 使用模型的 'id' 作为唯一标识符进行更新或插入操作
            result = collection.update_one(
                {"id": filtered_model["id"]},  # 使用模型 ID 作为查询条件
                {"$set": filtered_model},  # 更新过滤后的模型数据
                upsert=True  # 如果不存在则插入
            )

            # 打印保存操作的结果
            logger.info(f"MongoDB update result for model {filtered_model['id']}: {result.raw_result}")
        
        logger.info("Models successfully saved to MongoDB with filtered data.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save models to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save models")

@app.delete("/api/delete_model/{model_id}")
async def delete_model(model_id: str):
    try:
        db = client["threaddata"]  
        collection = db["models"]  # 模型数据的 collection

        # 检查模型是否存在并删除
        result = collection.delete_one({"id": model_id})

        if result.deleted_count == 0:
            logger.error(f"Model with id {model_id} not found.")
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")

        logger.info(f"Successfully deleted model {model_id}.")
        return {"status": "success", "message": f"Model {model_id} has been deleted"}

    except Exception as e:
        logger.error(f"Failed to delete model {model_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete model")


@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
                # 添加详细的日志记录
        logger.info(f"Received chat request: {request}")
        
        # 验证必要字段
        if not request.messages or not request.configuration:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # 确保 configuration 中的 model 字段存在
        if not request.configuration.model:
            raise HTTPException(status_code=400, detail="Model field is required in configuration")

        logger.info(f"Generating response with configuration: {request.configuration}")

        async def generate_response():
            state = multi_turn_question.run(
                request.messages, request.configuration, stream=True
            )
            full_response = ""

            async for chunk in state.text_async_iter(var_name="response"):
                full_response += chunk
                logger.info(f"Chunk received: {chunk}")  # 记录每个片段
                yield f"data: {chunk}\n\n"
            logger.info(f"Full response: {full_response}")  # 记录完整响应
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_response(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in /api/chat: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Backend error")

if __name__ == "__main__":
    logger.info("Starting FastAPI server...")

    uvicorn.run(app, host="0.0.0.0", port=8000)
    logger.info("API key loaded.")
    print("Allowed origins:", allowed_origins)
