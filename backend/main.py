import json
import logging
import os
import traceback
import uvicorn
from pathlib import Path
from typing import Dict, List, Union, Optional
from pymongo import MongoClient
import sglang as sgl
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import urllib.parse
from pymongo.server_api import ServerApi
import requests
import asyncio
import httpx
import openai
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


mongo_url =os.getenv("MONGODB_URI", "")
client = MongoClient(mongo_url, server_api=ServerApi('1'))


data_folder = parent_dir / "data"
if not data_folder.exists():
    data_folder.mkdir()
    logger.info(f"Created data folder: {data_folder}")

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

class FunctionParameters(BaseModel):
    type: str
    properties: Dict[str, Dict]
    required: List[str]

class Function(BaseModel):
    name: str
    description: str
    parameters: FunctionParameters

class Tool(BaseModel):
    name: str
    description: str
    enabled: bool
    type: str
    function: Function

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


# ------------------------- 工具加载和保存函数 -------------------------

def load_tools_from_db():
    """
    从 MongoDB 加载工具。如果数据库中没有工具，则初始化为默认工具。
    """
    global tools_list
    try:
        db = client["threaddata"]
        collection = db["tools"]
        tools_from_db = list(collection.find({}, {"_id": 0}))
        
        if not tools_from_db:
            logger.warning("数据库中未找到工具。初始化为默认工具。")
            tools_list = get_default_tools()
            save_tools_to_db(tools_list)  # 保存默认工具到数据库
        else:
            logger.info(f"成功从 MongoDB 加载了 {len(tools_from_db)} 个工具。")
            tools_list = tools_from_db
    except Exception as e:
        logger.error(f"加载工具失败: {str(e)}")
        tools_list = get_default_tools()
        save_tools_to_db(tools_list)  # 保存默认工具到数据库

def save_tools_to_db(tools: List[Dict]):
    """
    将工具列表保存到 MongoDB。
    
    参数:
    - tools: 工具列表，每个工具为字典格式。
    """
    try:
        db = client["threaddata"]
        collection = db["tools"]
        collection.delete_many({})  # 清空现有工具
        collection.insert_many(tools)  # 插入新工具
        logger.info("工具已成功保存到 MongoDB。")
    except Exception as e:
        logger.error(f"保存工具到 MongoDB 失败: {str(e)}")

def get_default_tools() -> List[Dict]:
    """
    返回默认工具的列表，包括 'Get Current Weather' 和 'calculate'。
    
    返回:
    - 包含默认工具配置的列表。
    """
    return [
        {
            "name": "Get Current Weather",
            "description": "Provides the current weather for a specified location.",
            "enabled": True,
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g., San Francisco, CA",
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                        },
                    },
                    "required": ["location"],
                },
            },
        },
        {
            "name": "Calculate",
            "description": "Performs basic arithmetic calculations.",
            "enabled": True,
            "type": "function",
            "function": {
                "name": "calculate",
                "description": "Performs basic arithmetic operations like addition, subtraction, multiplication, and division.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": ["add", "subtract", "multiply", "divide"],
                            "description": "The arithmetic operation to perform.",
                        },
                        "operand1": {
                            "type": "number",
                            "description": "The first operand.",
                        },
                        "operand2": {
                            "type": "number",
                            "description": "The second operand.",
                        },
                    },
                    "required": ["operation", "operand1", "operand2"],
                },
            },
        },
    ]
tools_list: List[Dict] = []

def startup_event():
    """
    应用启动时加载工具。
    """
    load_tools_from_db()

# 添加启动事件
app.add_event_handler("startup", startup_event)
def calculate(**kwargs):
    num1 = kwargs.get('operand1')
    num2 = kwargs.get('operand2')
    operation = kwargs.get('operation')

    try:
        num1 = float(num1)
        num2 = float(num2)
    except (ValueError, TypeError):
        raise ValueError("Both operand1 and operand2 should be numbers.")

    if operation == "add":
        result = num1 + num2
    elif operation == "subtract":
        result = num1 - num2
    elif operation == "multiply":
        result = num1 * num2
    elif operation == "divide":
        if num2 == 0:
            raise ValueError("Cannot divide by zero.")
        result = num1 / num2
    else:
        raise ValueError(f"Unsupported operation: {operation}")

    return {"result": result}

        
def get_coordinates(location):
    api_key = os.getenv('GOOGLE_GEOCODING_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_GEOCODING_API_KEY is not set")

    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(location)}&key={api_key}"
    response = requests.get(url)
    if not response.ok:
        raise ValueError(f"Error fetching coordinates: {response.status_code} {response.text}")
    data = response.json()
    if data['status'] != 'OK' or not data['results']:
        raise ValueError(f"Error in geocoding response: {data.get('error_message', 'Unknown error')}")
    result = data['results'][0]
    lat = result['geometry']['location']['lat']
    lon = result['geometry']['location']['lng']
    return lat, lon

# Function to get current weather using OpenWeatherMap API
def get_current_weather(location, unit='celsius'):
    lat, lon = get_coordinates(location)
    api_key = os.getenv('OPENWEATHER_API_KEY')
    if not api_key:
        raise ValueError("OPENWEATHER_API_KEY is not set")

    units_param = 'metric' if unit == 'celsius' else 'imperial' if unit == 'fahrenheit' else 'standard'
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units={units_param}"
    response = requests.get(url)
    if not response.ok:
        raise ValueError(f"Error fetching weather data: {response.status_code} {response.text}")
    data = response.json()
    return {
        'location': data['name'],
        'temperature': data['main']['temp'],
        'unit': unit,
        'description': data['weather'][0]['description'],
    }

async def stream_assistant_response(content):
    # 模拟流式响应，将内容分块发送
    chunk_size = 100  # 根据需要调整块大小
    for i in range(0, len(content), chunk_size):
        chunk = content[i:i+chunk_size]
        data = json.dumps({"choices": [{"delta": {"content": chunk}}]})
        yield f"data: {data}\n\n"
        await asyncio.sleep(0)  # 让出控制权
    yield "data: [DONE]\n\n"

async def stream_openai_response(response):
    async for line in response.aiter_lines():
        if line.startswith("data:"):
            data_str = line[5:].strip()
            if data_str == "[DONE]":
                yield "data: [DONE]\n\n"
                break
            try:
                data = json.loads(data_str)
                logger.info(f"Received data chunk: {data}")
                
                if 'error' in data:
                    logger.error(f"Error from OpenRouter: {data['error']}")
                    break  # 停止处理
                            
                # 直接将整个数据块发送给前端
                yield f"data: {json.dumps(data)}\n\n"
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                continue


def load_models_from_file():
    global models_list
    try:
        # 检查 models_file 是否存在
        if models_file.exists():
            with models_file.open("r", encoding="utf-8") as f:
                try:
                    models_list = json.load(f)
                    if not models_list:
                        logger.warning("models.json is empty. Initializing with default models.")
                        models_list = get_default_models()
                except json.JSONDecodeError:
                    logger.warning("models.json is invalid. Initializing with default models.")
                    models_list = get_default_models()
        else:
            # 如果文件不存在，则初始化默认模型
            models_list = get_default_models()
            logger.info("Initialized with default models.")
    except Exception as e:
        logger.error(f"Failed to load model file: {str(e)}")
        models_list = get_default_models()

def get_default_models():
    
    return [
        {
            "id": "default-model-id",
            "name": "Default Model",
            "baseModel": "openai/gpt-4o-2024-08-06",
            "systemPrompt":  """
You are a helpful assistant.


Use the tools when it's helpful, but if you can answer the user's question without it, feel free to do so.

Do not mention tools to the user unless necessary. Provide clear and direct answers to the user's queries.
""",
            "parameters": ({
                "temperature": 0.7,
                "max_tokens": 512,
               
            })
        }
    ]

# ------------------------- 工具 API 端点 -------------------------

@app.post("/api/save_tools")
async def save_tools(request: Request):
    """
    将工具保存到 MongoDB。
    
    参数:
    - request: 包含工具数据的 HTTP 请求。
    
    返回:
    - 一个 JSON 响应，表示保存成功或失败。
    """
    try:
        data = await request.json()
        tools = data.get("tools")
        if tools is None:
            raise HTTPException(status_code=400, detail="未提供工具数据")
        
        # 验证工具数据
        for tool in tools:
            try:
                Tool(**tool)
            except Exception as e:
                logger.error(f"工具数据验证失败: {str(e)}")
                raise HTTPException(status_code=400, detail=f"工具数据验证失败: {str(e)}")
        
        # 保存工具到数据库
        save_tools_to_db(tools)
        return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"保存工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail="保存工具失败")

@app.get("/api/load_tools")
async def load_tools():
    """
    从 MongoDB 加载工具。
    
    返回:
    - 一个包含工具列表的 JSON 响应。
    """
    try:
        db = client["threaddata"]
        collection = db["tools"]
        tools_from_db = list(collection.find({}, {"_id": 0}))
        
        if not tools_from_db:
            logger.warning("数据库中未找到工具。初始化为默认工具。")
            tools_list = get_default_tools()
            save_tools_to_db(tools_list)
        else:
            logger.info(f"成功从 MongoDB 加载了 {len(tools_from_db)} 个工具。")
            tools_list = tools_from_db
        
        return {"tools": tools_list}
    except Exception as e:
        logger.error(f"加载工具失败: {str(e)}")
        raise HTTPException(status_code=500, detail="加载工具失败")


@app.get("/api/connect")
async def connect():
    logger.info("Connected to backend.")
    return JSONResponse(content={"message": "successful"}, status_code=200)
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
        
  
         # 清空现有模型数据并插入新模型数据
        collection.delete_many({})  # 清空当前模型集合
        collection.insert_many(models)  # 插入新的模型数据
          
        logger.info("Models successfully saved to MongoDB.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save models to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save models")



@app.get("/api/load_models")
async def load_models():
    try:
        db = client["threaddata"]  # 连接到 MongoDB 数据库
        collection = db["models"]  # 使用 "models" 集合
        
        # 从 MongoDB 中获取所有模型
        models_from_db = list(collection.find({}, {"_id": 0}))  # 获取模型时排除 _id 字段
        
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
    
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"收到聊天请求: {request}")
        
        # ------------------------- 验证请求 -------------------------
        if not request.messages or not request.configuration:
            logger.error("请求中缺少必填字段。")
            raise HTTPException(status_code=400, detail="缺少必填字段")

        if not request.configuration.model:
            logger.error("配置中缺少 model 字段。")
            raise HTTPException(status_code=400, detail="配置中缺少 model 字段")

        # ------------------------- 准备消息和配置 -------------------------
        # 将消息列表转换为字典格式，符合 OpenRouter 的要求
        messages = [{'role': msg.role, 'content': msg.content} for msg in request.messages]
        logger.info(f"为 OpenRouter 准备的消息: {messages}")

        # ------------------------- 筛选启用的工具 -------------------------
        active_tools = [tool for tool in tools_list if tool.get("enabled", False)]
        for tool in active_tools:
            if '_id' in tool:
                tool['_id'] = str(tool['_id'])

        # ------------------------- 准备 OpenRouter API 参数 -------------------------
        params = {
            'model': request.configuration.model,
            'messages': messages,
            'tools': active_tools,  # 使用从数据库加载的 active_tools 列表
            'tool_choice': request.configuration.tool_choice or 'auto',
            'temperature': request.configuration.temperature,
            'max_tokens': request.configuration.max_tokens,
            'top_p': request.configuration.top_p,
            'frequency_penalty': request.configuration.frequency_penalty,
            'presence_penalty': request.configuration.presence_penalty,
            'repetition_penalty': request.configuration.repetition_penalty,
            'min_p': request.configuration.min_p,
            'top_a': request.configuration.top_a,
            'seed': request.configuration.seed,
            'context_length': request.configuration.context_length,
            'top_k': request.configuration.top_k,
            'logit_bias': request.configuration.logit_bias,
            'logprobs': request.configuration.logprobs,
            'top_logprobs': request.configuration.top_logprobs,
            'response_format': request.configuration.response_format,
            'stop': request.configuration.stop,
            'stream': False,  # 初始请求不启用流式
        }
        logger.info(f"为 OpenRouter API 准备的参数: {params}")

        # ------------------------- 设置请求头部 -------------------------
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {openrouter_api_key}',
            'HTTP-Referer': os.getenv('NEXT_PUBLIC_APP_URL', 'http://aide.zy-j.com'),
            'X-Title': 'Aide',
        }
        logger.info(f"为 OpenRouter API 准备的头部: {headers}")

        # ------------------------- 发送初始请求 -------------------------
        async with httpx.AsyncClient() as client:
            # 初始请求不启用流式
            params['stream'] = False
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=headers,
                json=params
            )
            logger.info(f"初始响应状态码: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"OpenRouter API 错误: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"OpenRouter API 错误: {response.text}")

            # 解析初始响应数据
            initial_data = response.json()
            logger.info(f"从 OpenRouter 收到的初始数据: {initial_data}")
            if 'choices' in initial_data and initial_data['choices']:
                assistant_message = initial_data['choices'][0]['message']
            else:
                logger.error(f"初始响应中出错: {initial_data.get('error')}")
                raise HTTPException(status_code=400, detail=f"初始响应中出错: {initial_data.get('error', {}).get('message', '未知错误')}")

            # ------------------------- 检查并处理工具调用 -------------------------
            tool_calls = assistant_message.get('tool_calls') if assistant_message else None
            if tool_calls:
                logger.info(f"检测到工具调用: {tool_calls}")
                # 将助手的消息添加到消息列表中
                messages.append(assistant_message)
                for tool_call in tool_calls:
                    function = tool_call.get('function', {})
                    tool_name = function.get('name')
                    arguments_str = function.get('arguments')
                    if arguments_str:
                        try:
                            tool_args = json.loads(arguments_str)
                        except json.JSONDecodeError:
                            logger.error(f"工具参数中的 JSON 无效: {arguments_str}")
                            continue
                    else:
                        tool_args = {}
                    
                    logger.info(f"处理工具调用: {tool_name}，参数: {tool_args}")
                    
                    # 根据工具名称执行相应的函数
                    if tool_name == 'get_current_weather':
                        location = tool_args.get('location')
                        unit = tool_args.get('unit', 'celsius')
                        try:
                            tool_result = get_current_weather(location, unit)
                            logger.info(f"工具结果: {tool_result}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps(tool_result),
                            })
                        except Exception as e:
                            logger.error(f"执行工具 '{tool_name}' 时出错: {str(e)}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps({"error": str(e)}),
                            })
                    
                    elif tool_name == 'calculate':
                        try:
                            tool_result = calculate(**tool_args)
                            logger.info(f"工具结果: {tool_result}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps(tool_result),
                            })
                        except Exception as e:
                            logger.error(f"执行工具 '{tool_name}' 时出错: {str(e)}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps({"error": str(e)}),
                            })
    
            # ------------------------- 发送最终请求并流式响应 -------------------------
            # 无论是否有工具调用，始终使用 stream_openai_response 进行流式响应
                params['messages'] = messages
                params['stream'] = True  # 启用流式

                final_response = await client.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    headers=headers,
                    json=params
                )
                logger.info(f"最终响应状态码: {final_response.status_code}")
                # 无论是否有工具调用，始终使用 stream_openai_response 进行流式响应
                return StreamingResponse(stream_openai_response(final_response), media_type="text/event-stream")
            else:
                # 如果没有工具调用，仍然使用 stream_openai_response 进行流式响应
                logger.info("未检测到工具调用。通过流式方式返回助手的响应。")
                # 为了符合您的需求，这里将创建一个虚拟的 final_response
                # 由于初始请求已设置 stream=False，我们需要重新发送一个请求来获取流式响应
                params['messages'] = messages
                params['stream'] = True  # 启用流式

                final_response = await client.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    headers=headers,
                    json=params
                )
                logger.info(f"最终响应状态码: {final_response.status_code}")
                return StreamingResponse(stream_openai_response(final_response), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"/api/chat 中的错误: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="后台错误")

    
if __name__ == "__main__":
    import uvicorn
 
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    logger.info("API key loaded.")
    print("Allowed origins:", allowed_origins)
