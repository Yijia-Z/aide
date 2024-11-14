import json
import logging
import os
import traceback
import uvicorn
import sys

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
from bson import ObjectId
import importlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up environment and data directory
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
dotenv_path = parent_dir / ".env.local"

if not dotenv_path.exists():
    logger.error(f"Missing .env.local file {dotenv_path}")
    raise FileNotFoundError(f".env.local not found at this path {dotenv_path}")

load_dotenv(dotenv_path=dotenv_path)

mongo_url = os.getenv("MONGODB_URI")
if not mongo_url:
    logger.error("MONGODB_URI is not set in environment variables.")
    raise RuntimeError("Missing MONGODB_URI.")

clientdb = MongoClient(mongo_url, server_api=ServerApi('1'))

data_folder = parent_dir / "data"
if not data_folder.exists():
    data_folder.mkdir()
    logger.info(f"Created data folder {data_folder}")

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

# ------------------------- Pydantic Models -------------------------

class Message(BaseModel):
    role: str
    content: Optional[str] = None

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

class ToolUseResponse(BaseModel):
    role: str
    name: str
    tool_call_id: str
    content: str

class ToolUseRequest(BaseModel):
    tool_name: str
    tool_args: dict
    tool_call_id: str

# ------------------------- SGLang Function -------------------------

@sgl.function
def multi_turn_question(s, messages: List[Message], config: Configuration):
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

# ------------------------- Tool Loading and Saving Functions -------------------------

def load_tools_from_db():
    """
    Load tools from MongoDB. If no tools are found in the database, initialize with default tools.
    """
    global tools_list
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        tools_from_db = list(collection.find({}, {"_id": 0}))
        
        if not tools_from_db:
            logger.warning("No tools found in the database. Initializing with default tools.")
            tools_list = get_default_tools()
            save_tools_to_db(tools_list)  # Save default tools to the database
        else:
            logger.info(f"Successfully loaded {len(tools_from_db)} tools from MongoDB.")
            tools_list = tools_from_db
    except Exception as e:
        logger.error(f"Failed to load tools: {str(e)}")
        tools_list = get_default_tools()
        save_tools_to_db(tools_list)  # Save default tools to the database

def save_tools_to_db(tools: List[Dict]):
    """
    Save the list of tools to MongoDB.

    Parameters:
    - tools: List of tools, each tool as a dictionary.
    """
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        collection.delete_many({})  # Clear existing tools
        collection.insert_many(tools)  # Insert new tools
        logger.info("Tools successfully saved to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to save tools to MongoDB: {str(e)}")

def get_default_tools() -> List[Dict]:
    """
    Return a list of default tools, including 'Get Current Weather' and 'calculate'.

    Returns:
    - List of default tool configurations.
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
                            "enum": [
                                "celsius",
                                "fahrenheit"
                            ],
                        },
                    },
                    "required": [
                        "location",
                    ],
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
                            "enum": [
                                "add",
                                "subtract",
                                "multiply",
                                "divide"
                            ],
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
                    "required": [
                        "operation",
                        "operand1",
                        "operand2",
                    ],
                },
            },
        },
    ]

tools_list: List[Dict] = []

def startup_event():
    """
    Load tools on application startup.
    """
    load_tools_from_db()

# Add startup event handler
app.add_event_handler("startup", startup_event)

# ------------------------- Tool Functions -------------------------

def calculate(kwargs: Dict) -> Dict:
    """
    Perform basic arithmetic operations.

    Parameters:
    - kwargs: Dictionary containing 'operation', 'operand1', 'operand2'.

    Returns:
    - Dictionary with the result.
    """
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

def get_coordinates(location: str) -> (float, float):
    """
    Get latitude and longitude for a given location using Google Geocoding API.

    Parameters:
    - location: The location string.

    Returns:
    - Tuple of (latitude, longitude).
    """
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

def get_current_weather(location: str, unit: str = 'celsius') -> Dict:
    """
    Get current weather using OpenWeatherMap API.

    Parameters:
    - location: The location string.
    - unit: Temperature unit ('celsius' or 'fahrenheit').

    Returns:
    - Dictionary containing weather information.
    """
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
        "location": data['name'],
        "temperature": data['main']['temp'],
        "unit": unit,
        "description": data['weather'][0]['description'],
    }

# ------------------------- Utility Functions -------------------------

def serialize_tool(tool: Dict) -> Dict:
    """
    Serialize tool data, handling non-serializable fields like ObjectId.

    Parameters:
    - tool: Tool dictionary.

    Returns:
    - Serialized tool dictionary.
    """
    serialized = {}
    for key, value in tool.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, dict):
            serialized[key] = serialize_tool(value)  # Recursive handling
        elif isinstance(value, list):
            serialized[key] = [serialize_tool(item) if isinstance(item, dict) else item for item in value]
        else:
            serialized[key] = value
    return serialized

def load_models_from_file():
    global models_list
    models_file = parent_dir / "models.json"
    try:
        # Check if models_file exists
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
            # If the file does not exist, initialize with default models
            models_list = get_default_models()
            logger.info("Initialized with default models.")
    except Exception as e:
        logger.error(f"Failed to load model file: {str(e)}")
        models_list = get_default_models()

def get_default_models() -> List[Dict]:
    return [
        {
            "id": "default-model-id",
            "name": "Default Model",
            "baseModel": "openai-gpt-4o-2024-08-06",
            "systemPrompt": """
You are a helpful assistant.

Use the tools when it's helpful, but if you can answer the user's question without it, feel free to do so.

Do not mention tools to the user unless necessary. Provide clear and direct answers to the user's queries.
""",
            "parameters": {
                "temperature": 0.7,
                "max_tokens": 512,
                # Add other default parameters as needed
            }
        }
    ]

# ------------------------- API Endpoints -------------------------

@app.post("/api/save_tools")
async def save_tools_endpoint(request: Request):
    """
    Save tools to MongoDB.

    Parameters:
    - request: HTTP request containing tool data.

    Returns:
    - JSON response indicating success or failure.
    """
    try:
        data = await request.json()
        tools = data.get("tools")
        if tools is None:
            raise HTTPException(status_code=400, detail="No tool data provided.")
        
        # Validate tool data
        for tool in tools:
            try:
                Tool(**tool)
            except Exception as e:
                logger.error(f"Tool data validation failed: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Tool data validation failed: {str(e)}")
        
        # Save tools to the database
        save_tools_to_db(tools)
        return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Failed to save tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save tools.")

@app.get("/api/load_tools")
async def load_tools_endpoint():
    """
    Load tools from MongoDB.

    Returns:
    - JSON response containing the list of tools.
    """
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        tools_from_db = list(collection.find({}, {"_id": 0}))
        
        if not tools_from_db:
            logger.warning("No tools found in the database. Initializing with default tools.")
            tools_list = get_default_tools()
            save_tools_to_db(tools_list)
        else:
            logger.info(f"Successfully loaded {len(tools_from_db)} tools from MongoDB.")
            tools_list = tools_from_db
        
        return {"tools": tools_list}
    except Exception as e:
        logger.error(f"Failed to load tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load tools.")

@app.get("/api/connect")
async def connect_endpoint():
    """
    Check connection to backend.
    """
    logger.info("Connected to backend.")
    return JSONResponse(content={"message": "successful"}, status_code=200)

@app.post("/api/save_thread")
async def save_thread_endpoint(thread_data: ThreadData):
    """
    Save thread data to MongoDB.

    Parameters:
    - thread_data: ThreadData object containing thread ID and thread data.

    Returns:
    - JSON response indicating success or failure.
    """
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread
        
        db = clientdb["threaddata"] 
        collection_name = f"thread_{thread_id}" 
        collection = db[collection_name]
        
        result = collection.update_one(
            {"threadId": thread_id},
            {"$set": thread},
            upsert=True  # Insert if not exists
        )
        
        logger.info(f"Successfully saved thread {thread_id} to collection {collection_name}.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save thread to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save thread.")

@app.get("/api/load_threads")
async def load_threads_endpoint():
    """
    Load all threads from MongoDB.

    Returns:
    - JSON response containing the list of threads.
    """
    try:
        db = clientdb["threaddata"]
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
        raise HTTPException(status_code=500, detail="Failed to load threads.")

@app.delete("/api/delete_thread/{thread_id}")
async def delete_thread_endpoint(thread_id: str):
    """
    Delete a specific thread from MongoDB.

    Parameters:
    - thread_id: The ID of the thread to delete.

    Returns:
    - JSON response indicating success or failure.
    """
    try:
        db = clientdb["threaddata"] 
        collection_name = f"thread_{thread_id}"
        
        if collection_name in db.list_collection_names():
            db.drop_collection(collection_name)
            logger.info(f"Successfully deleted thread {thread_id} (collection {collection_name}).")
            return {
                "status": "success",
                "message": f"Thread {thread_id} (collection {collection_name}) has been deleted.",
            }
        else:
            logger.error(f"Thread {thread_id} does not exist.")
            raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found.")
    except Exception as e:
        logger.error(f"Failed to delete thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete thread.")

@app.post("/api/save_models")
async def save_models_endpoint(request: Request):
    """
    Save models to MongoDB.

    Parameters:
    - request: HTTP request containing model data.

    Returns:
    - JSON response indicating success or failure.
    """
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided.")
        
        # Connect to MongoDB collection for saving model data
        db = clientdb["threaddata"]  
        collection = db["models"]  
        
        # Clear existing model data and insert new model data
        collection.delete_many({})  # Clear current model collection
        collection.insert_many(models)  # Insert new model data
          
        logger.info("Models successfully saved to MongoDB.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save models to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save models.")

@app.get("/api/load_models")
async def load_models_endpoint():
    """
    Load models from MongoDB.

    Returns:
    - JSON response containing the list of models.
    """
    try:
        db = clientdb["threaddata"]  # Connect to MongoDB database
        collection = db["models"]  # Use the models collection
        
        # Retrieve all models from MongoDB
        models_from_db = list(collection.find({}, {"_id": 0}))  # Exclude _id field when fetching models
        
        if not models_from_db:
            logger.warning("No models found in the database. Attempting to load from file.")
            load_models_from_file()  # If no models in database, try loading from file
            if not models_list:
                logger.warning("No models found in file either. Initializing with default models.")
                models_list = get_default_models()  # If no models in file, return default models
        else:
            logger.info(f"Successfully loaded {len(models_from_db)} models from MongoDB.")
            models_list = models_from_db  # Models loaded from database
        return {"models": models_list}
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load models from database or file.")

@app.get("/api/check_model_tools_support/{model_id}")
async def check_model_tools_support(model_id: str):
    """
    Check if a model supports tools.

    Parameters:
    - model_id: The ID of the model to check.

    Returns:
    - JSON response indicating whether tools are supported and the list of tools.
    """
    try:
        logger.info(f"Received request to check model tool support, model_id {model_id}")
        dbm = clientdb["threaddata"]  # Connect to MongoDB database
        dbms = dbm["models"]  # Use models collection
        dbls = dbm["tools"]  # Use tools collection

        # Find the model in the database
        model = dbms.find_one({"id": model_id})  # Assume the model has a unique 'id' field
        if not model:
            logger.error(f"Model not found: {model_id}")
            raise HTTPException(status_code=404, detail="Model not found.")
        
        # Get the actual model ID from OpenRouter
        basemodel = model.get("baseModel")
        if not basemodel:
            logger.error(f"Model {model_id} does not have a 'basemodel' field configured.")
            raise HTTPException(status_code=400, detail="Model does not have 'basemodel' field configured.")
        
        logger.info(f"Model {model_id} basemodel {basemodel}")

        # Get the OpenRouter API key
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if not openrouter_api_key:
            logger.error("Missing OPENROUTER_API_KEY environment variable.")
            raise RuntimeError("Missing OPENROUTER_API_KEY.")
        
        headers = {
            'Authorization': f'Bearer {openrouter_api_key}',
            'Content-Type': 'application/json',
        }

        # Construct request URL
        openrouter_url = f'https://openrouter.ai/api/v1/parameters/{basemodel}'
        logger.info(f"Sending request to OpenRouter Parameters API {openrouter_url}, Headers {headers}")

        async with httpx.AsyncClient() as client:
            response = await client.get(openrouter_url, headers=headers)

        logger.info(f"Received response from OpenRouter Parameters API, Status Code {response.status_code}")

        if response.status_code != 200:
            logger.error(f"OpenRouter Parameters API error {response.status_code} - {response.text}")
            # If model not found or error occurs, assume tools are not supported
            return {"supportsTools": False}
        
        data = response.json()
        logger.debug(f"OpenRouter Parameters API response body {data}")

        supported_parameters = data.get('data', {}).get('supported_parameters', [])
        supports_tools = 'tools' in supported_parameters

        logger.info(f"Does model {model_id} support tools: {supports_tools}")

        if supports_tools:
            # Load tools from the database
            tools = list(dbls.find({}))
            serialized_tools = [serialize_tool(tool) for tool in tools]
            logger.info(f"Loaded {len(serialized_tools)} tools.")
            return {"supportsTools": True, "tools": serialized_tools}
        else:
            logger.info(f"Model {model_id} does not support tools.")
            return {"supportsTools": False}

    except Exception as e:
        logger.error(f"Error checking model tool support: {str(e)}")
        # On error, assume tools are not supported
        return {"supportsTools": False}

@app.post("/api/process_tool_use")
async def process_tool_use(request: ToolUseRequest):
    """
    Process tool use by dynamically importing and executing the specified tool function.

    Parameters:
    - request: ToolUseRequest object containing tool name, arguments, and tool call ID.

    Returns:
    - ToolUseResponse object containing the result or error.
    """
    tool_name = request.tool_name
    tool_args = request.tool_args
    tool_call_id = request.tool_call_id

    # 假设工具函数位于 'tool_functions' 目录
    # 获取当前文件的目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # 工具函数目录
    tool_functions_dir = os.path.join(current_dir, '..', 'tool_functions')

    # 将工具函数目录添加到 sys.path，以便可以导入模块
    if tool_functions_dir not in sys.path:
        sys.path.append(tool_functions_dir)
        logger.info(f"Added {tool_functions_dir} to sys.path")

    # 列出所有可调用的函数
    logger.info("Listing all callable functions in each module within 'tool_functions'")
    for filename in os.listdir(tool_functions_dir):
        if filename.endswith('.py'):
            module_name = filename[:-3]  # Remove the '.py' extension to get the module name
            try:
                # Import the module dynamically
                module = importlib.import_module(module_name)
                # List all callable functions in the module
                callable_functions = [func for func in dir(module) if callable(getattr(module, func))]
                logger.info(f"Module '{module_name}' callable functions: {callable_functions}")
            except Exception as e:
                logger.error(f"Error loading module '{module_name}': {e}")

    try:
        # 动态导入模块，假设模块名与 tool_name 相同
        module = importlib.import_module(tool_name)
    except ImportError as e:
        error_message = f"未找到工具 '{tool_name}'。"
        logger.error(error_message)
        raise HTTPException(status_code=404, detail=error_message)

    try:
        callable_functions = [func for func in dir(module) if callable(getattr(module, func))]
        logger.info(f"Callable functions in '{tool_name}': {callable_functions}")
        # 获取模块中的函数，假设函数名与模块名相同，或者统一为 'run'
        if hasattr(module, tool_name):
            function = getattr(module, tool_name)
        elif hasattr(module, 'run'):
            function = getattr(module, 'run')
        elif hasattr(module, 'execute'):
            function = getattr(module, 'execute')
        else:
            error_message = f"在工具 '{tool_name}' 中未找到可执行的函数。"
            logger.error(error_message)
            raise HTTPException(status_code=500, detail=error_message)
    except Exception as e:
        error_message = f"获取工具 '{tool_name}' 中的函数时出错：{str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)

    try:
        # 执行函数，传入 tool_args 作为关键字参数
        result = function(**tool_args)
        logger.info(f"Executed function '{tool_name}' with args {tool_args}, result: {result}")
    except Exception as e:
        # 捕获并记录异常
        traceback_str = ''.join(traceback.format_exception(None, e, e.__traceback__))
        error_message = f"执行工具 '{tool_name}' 时出错：{str(e)}\n{traceback_str}"
        logger.error(error_message)
        # 返回错误信息
        return {
            'role': 'tool',
            'name': tool_name,
            'tool_call_id': tool_call_id,
            'content': json.dumps({'error': error_message}, ensure_ascii=False),
        }

    # 将结果转换为 JSON 字符串（如果需要）
    if not isinstance(result, str):
        result = json.dumps(result, ensure_ascii=False)

    # 返回成功结果
    return {
        'role': 'tool',
        'name': tool_name,
        'tool_call_id': tool_call_id,
        'content': result,
    }


# ------------------------- Main Entrypoint -------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    logger.info("API key loaded.")
    logger.info(f"Allowed origins: {allowed_origins}")
