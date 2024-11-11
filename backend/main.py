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

mongo_url = os.getenv("MONGODB_URI", "")
clientdb = MongoClient(mongo_url, server_api=ServerApi('1'))

data_folder = parent_dir / "data"
if not data_folder.exists():
    data_folder.mkdir()
    logger.info(f"Created data folder: {data_folder}")

app = FastAPI()
origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

class ToolParameter(BaseModel):
    type: str
    description: Optional[str] = None
    enum: Optional[List[str]] = None

class ToolFunction(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Dict[str, Union[str, Dict, List]]]

class Tool(BaseModel):
    id: str
    name: str
    description: str
    enabled: bool
    type: str
    function: ToolFunction

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
            "id": "weather",
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
            "id": "calculator",
            "name": "Calculate",
            "description": "Performs basic arithmetic calculations.",
            "enabled": True,
            "type": "function",
            "function": {
                "name": "calculate",
                "description": "Performs basic arithmetic operations",
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
        }
    ]

tools_list: List[Dict] = []

def startup_event():
    """
    Load tools on application startup.
    """
    load_tools_from_db()

# Add startup event handler
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
    # Simulate streaming response by sending content in chunks
    chunk_size = 100  # Adjust chunk size as needed
    for i in range(0, len(content), chunk_size):
        chunk = content[i:i+chunk_size]
        data = json.dumps({"choices": [{"delta": {"content": chunk}}]})
        yield f"data: {data}\n\n"
        await asyncio.sleep(0)  # Yield control
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
                    break  # Stop processing
                            
                # Directly send the entire data chunk to the frontend
                yield f"data: {json.dumps(data)}\n\n"
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                continue

def load_models_from_file():
    global models_list
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

# ------------------------- Tool API Endpoints -------------------------

@app.post("/api/save_tools")
async def save_tools(request: Request):
    """Save tools to database."""
    try:
        data = await request.json()
        tools = data.get("tools", [])
        
        db = clientdb["threaddata"]
        collection = db["tools"]
        
        # Clear existing tools
        collection.delete_many({})
        
        # Insert new tools if any exist
        if tools:
            collection.insert_many(tools)
            logger.info(f"Saved {len(tools)} tools to database")
        
        return {"status": "success", "message": "Tools saved successfully"}
    except Exception as e:
        logger.error(f"Failed to save tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save tools")

@app.get("/api/load_tools")
async def load_tools():
    """Load tools from database or initialize with defaults if none exist."""
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        
        # Find all tools in the collection
        tools = list(collection.find({}, {"_id": 0}))
        
        # If no tools exist in the database, initialize with defaults
        if not tools:
            logger.info("No tools found in database. Initializing with defaults...")
            tools = get_default_tools()
            # Insert default tools into database
            if tools:
                collection.insert_many(tools)
                logger.info(f"Inserted {len(tools)} default tools into database")
        
        logger.info(f"Loaded {len(tools)} tools")
        return {"tools": tools}
    except Exception as e:
        logger.error(f"Failed to load tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load tools")

@app.get("/api/connect")
async def connect_endpoint():
    logger.info("Connected to backend.")
    return JSONResponse(content={"message": "successful"}, status_code=200)

@app.post("/api/save_thread")
async def save_thread(thread_data: ThreadData):
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
        raise HTTPException(status_code=500, detail="Failed to save thread")

@app.get("/api/load_threads")
async def load_threads_endpoint():
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
        raise HTTPException(status_code=500, detail="Failed to load threads")

@app.delete("/api/delete_thread/{thread_id}")
async def delete_thread_endpoint(thread_id: str):
    try:
        db = clientdb["threaddata"] 
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
async def save_models_endpoint(request: Request):
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided")
        
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
        raise HTTPException(status_code=500, detail="Failed to save models")

@app.get("/api/load_models")
async def load_models_endpoint():
    try:
        db = clientdb["threaddata"]  # Connect to MongoDB database
        collection = db["models"]  # Use the "models" collection
        
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
        raise HTTPException(status_code=500, detail="Failed to load models from database or file")

@app.get("/api/check_model_tools_support/{model_id}")
async def check_model_tools_support(model_id: str):
    try:
        logger.info(f"Received request to check model tool support, model_id: {model_id}")
        dbm = clientdb["threaddata"]  # Connect to MongoDB database
        dbms = dbm["models"]  # Use "models" collection
        dbls = dbm["tools"]  # Use "tools" collection

        # Find the model in the database
        model = dbms.find_one({"id": model_id})  # Assume the model has a unique 'id' field
        if not model:
            logger.error(f"Model not found: {model_id}")
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Get the actual model ID from OpenRouter
        basemodel = model.get("baseModel")
        if not basemodel:
            logger.error(f"Model {model_id} does not have a 'basemodel' field configured")
            raise HTTPException(status_code=400, detail="Model does not have 'basemodel' field configured")
        
        logger.info(f"Model {model_id} basemodel: {basemodel}")

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
        logger.info(f"Sending request to OpenRouter Parameters API: {openrouter_url}, Headers: {headers}")

        async with httpx.AsyncClient() as client:
            response = await client.get(openrouter_url, headers=headers)

        logger.info(f"Received response from OpenRouter Parameters API, Status Code: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"OpenRouter Parameters API error: {response.status_code} - {response.text}")
            # If model not found or error occurs, assume tools are not supported
            return {"supportsTools": False}
        
        data = response.json()
        logger.debug(f"OpenRouter Parameters API response body: {data}")

        supported_parameters = data.get('data', {}).get('supported_parameters', [])
        supports_tools = 'tools' in supported_parameters

        logger.info(f"Does model {model_id} support tools: {supports_tools}")

        if supports_tools:
            # Load tools from the database
            db = clientdb["threaddata"]
            collection = db["tools"]
            available_tools = list(collection.find({"enabled": True}, {"_id": 0}))
            
            # If no tools in database, get defaults
            if not available_tools:
                available_tools = get_default_tools()
                if available_tools:
                    collection.insert_many(available_tools)
            
            logger.info(f"Returning {len(available_tools)} available tools for model {model_id}")
            return {
                "supportsTools": True,
                "available_tools": available_tools
            }
        else:
            return {"supportsTools": False}
    except Exception as e:
        logger.error(f"Error checking model tool support: {str(e)}")
        return {"supportsTools": False}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request: {request}")
        
        # ------------------------- Validate Request -------------------------
        if not request.messages or not request.configuration:
            logger.error("Missing required fields in the request.")
            raise HTTPException(status_code=400, detail="Missing required fields")

        if not request.configuration.model:
            logger.error("Missing 'model' field in configuration.")
            raise HTTPException(status_code=400, detail="Missing 'model' field in configuration")

        # ------------------------- Prepare Messages and Configuration -------------------------
        # Convert the list of messages to a dictionary format compatible with OpenRouter
        messages = [{'role': msg.role, 'content': msg.content} for msg in request.messages]
        logger.info(f"Prepared messages for OpenRouter: {messages}")

        # ------------------------- Filter Enabled Tools -------------------------
        active_tools = [tool for tool in tools_list if tool.get("enabled", False)]
        for tool in active_tools:
            if '_id' in tool:
                tool['_id'] = str(tool['_id'])

        # ------------------------- Prepare OpenRouter API Parameters -------------------------
        params = {
            'model': request.configuration.model,
            'messages': messages,
            'tools': active_tools,  # Use the active_tools list loaded from the database
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
            'stream': False,  # Initial request does not enable streaming
        }
        logger.info(f"Prepared parameters for OpenRouter API: {params}")

        # ------------------------- Set Request Headers -------------------------
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {openrouter_api_key}',
            'HTTP-Referer': os.getenv('NEXT_PUBLIC_APP_URL', 'http://aide.zy-j.com'),
            'X-Title': 'Aide',
        }
        logger.info(f"Prepared headers for OpenRouter API: {headers}")

        # ------------------------- Send Initial Request -------------------------
        async with httpx.AsyncClient() as client:
            # Initial request does not enable streaming
            params['stream'] = False
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers=headers,
                json=params
            )
            logger.info(f"Initial response status code: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"OpenRouter API error: {response.text}")

            # Parse initial response data
            initial_data = response.json()
            logger.info(f"Received initial data from OpenRouter: {initial_data}")
            if 'choices' in initial_data and initial_data['choices']:
                assistant_message = initial_data['choices'][0]['message']
            else:
                logger.error(f"Error in initial response: {initial_data.get('error')}")
                raise HTTPException(status_code=400, detail=f"Error in initial response: {initial_data.get('error', {}).get('message', 'Unknown error')}")

            # ------------------------- Check and Handle Tool Calls -------------------------
            tool_calls = assistant_message.get('tool_calls') if assistant_message else None
            if tool_calls:
                logger.info(f"Detected tool calls: {tool_calls}")
                # Add assistant's message to the message list
                messages.append(assistant_message)
                for tool_call in tool_calls:
                    function = tool_call.get('function', {})
                    tool_name = function.get('name')
                    arguments_str = function.get('arguments')
                    if arguments_str:
                        try:
                            tool_args = json.loads(arguments_str)
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON in tool arguments: {arguments_str}")
                            continue
                    else:
                        tool_args = {}
                    
                    logger.info(f"Processing tool call: {tool_name}, arguments: {tool_args}")
                    
                    # Execute the corresponding function based on tool name
                    if tool_name == 'get_current_weather':
                        location = tool_args.get('location')
                        unit = tool_args.get('unit', 'celsius')
                        try:
                            tool_result = get_current_weather(location, unit)
                            logger.info(f"Tool result: {tool_result}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps(tool_result),
                            })
                        except Exception as e:
                            logger.error(f"Error executing tool '{tool_name}': {str(e)}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps({"error": str(e)}),
                            })
                    
                    elif tool_name == 'calculate':
                        try:
                            tool_result = calculate(**tool_args)
                            logger.info(f"Tool result: {tool_result}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps(tool_result),
                            })
                        except Exception as e:
                            logger.error(f"Error executing tool '{tool_name}': {str(e)}")
                            messages.append({
                                'role': 'tool',
                                'name': tool_name,
                                'tool_call_id': tool_call['id'],
                                'content': json.dumps({"error": str(e)}),
                            })

                # ------------------------- Send Final Request and Stream Response -------------------------
                # Regardless of whether there are tool calls, always use stream_openai_response for streaming
                params['messages'] = messages
                params['stream'] = True  # Enable streaming

                final_response = await client.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    headers=headers,
                    json=params
                )
                logger.info(f"Final response status code: {final_response.status_code}")
                # Always use stream_openai_response for streaming
                return StreamingResponse(stream_openai_response(final_response), media_type="text/event-stream")
            else:
                # If no tool calls are detected, still use stream_openai_response for streaming
                logger.info("No tool calls detected. Returning assistant's response via streaming.")
                # To meet your requirement, create a virtual final_response here
                # Since the initial request has stream=False, we need to resend a request to get streaming response
                params['messages'] = messages
                params['stream'] = True  # Enable streaming

                final_response = await client.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    headers=headers,
                    json=params
                )
                logger.info(f"Final response status code: {final_response.status_code}")
                return StreamingResponse(stream_openai_response(final_response), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in /api/chat: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Backend error")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
    
    logger.info("API key loaded.")
    print("Allowed origins:", allowed_origins)
