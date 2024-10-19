import json
import logging
import os
import traceback
import uvicorn
from pathlib import Path
from typing import Dict, List, Union

import sglang as sgl
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

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
    max_tokens: int = None
    temperature: float = None
    top_p: float = None
    frequency_penalty: float = None
    presence_penalty: float = None
    top_k: int = None
    stop: Union[str, List[str]] = None
    logit_bias: Dict[str, float] = None
    top_a: float = None
    seed: int = None
    context_length: int = None
    min_p: float = None
    repetition_penalty: float = None
    logprobs: int = None
    top_logprobs: int = None
    response_format: Dict = None
    tools: List = None
    tool_choice: Union[str, Dict] = None

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
    temperature: float
    maxTokens: int


@sgl.function
def multi_turn_question(
    s, messages: List[Message], config: Configuration
):
    # Set the model configuration
    s.model = config.model
    s.temperature = config.temperature or s.temperature
    s.max_tokens = config.max_tokens or s.max_tokens
    """     s.top_p = config.top_p or s.top_p
        s.frequency_penalty = config.frequency_penalty or s.frequency_penalty
        s.presence_penalty = config.presence_penalty or s.presence_penalty
        s.repetition_penalty = config.repetition_penalty or s.repetition_penalty
        s.min_p = config.min_p or s.min_p
        s.top_a = config.top_a or s.top_a
        s.seed = config.seed or s.seed
        s.context_length = config.context_length or s.context_length
        s.top_k = config.top_k or s.top_k
        s.logit_bias = config.logit_bias or s.logit_bias
        s.logprobs = config.logprobs or s.logprobs
        s.top_logprobs = config.top_logprobs or s.top_logprobs
        s.response_format = config.response_format or s.response_format
        s.stop = config.stop or s.stop
        s.tools = config.tools or s.tools
        s.tool_choice = config.tool_choice or s.tool_choice
 """
    # Process messages
    for msg in messages:
        if msg.role == "system":
            s += sgl.system(msg.content)
        elif msg.role == "user":
            s += sgl.user(msg.content)
        elif msg.role == "assistant":
            s += sgl.assistant(msg.content)
    s += sgl.assistant(sgl.gen("response"))

models_file = data_folder / "models.json"
models_list = []


def load_models_from_file():
    global models_list
    try:
        if models_file.exists():
            with models_file.open("r", encoding="utf-8") as f:
                models_list = json.load(f)
        else:
            models_list = [
                {
                    "id": "1",
                    "name": "Default Model",
                    "baseModel": "gpt-4o-mini",
                    "systemPrompt": "You are a helpful assistant.",
                    "temperature": 0.7,
                    "maxTokens": 512,
                }
            ]
    except Exception as e:
        logger.error(f"Failed to load model file: {str(e)}")
        models_list = []


load_models_from_file()


@app.get("/api/connect")
async def connect():
    logger.info("Connected to backend.")
    return JSONResponse(content={"message": "successful"}, status_code=200)


@app.post("/api/save_thread")
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
        raise HTTPException(status_code=500, detail="Failed to save thread")


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
        logger.info(f"Successfully loaded {len(threads)} threads.")
        return {"threads": threads}
    except Exception as e:
        logger.error(f"Failed to load threads: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load threads")


@app.delete("/api/delete_thread/{thread_id}")
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


@app.get("/api/load_models")
async def load_models():
    try:
        models_file = data_folder / "models.json"
        if not models_file.exists():
            default_models = [
                {
                    "id": "1",
                    "name": "Default Model",
                    "baseModel": "gpt-4o-mini",
                    "systemPrompt": "You are a helpful assistant.",
                    "temperature": 0.7,
                    "maxTokens": 512,
                }
            ]
            return {"models": default_models}
        else:
            with models_file.open("r", encoding="utf-8") as f:
                models = json.load(f)
            return {"models": models}
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load models")


@app.post("/api/save_models")
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


@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.info(f"Generating response with configuration: {request.configuration}")

        async def generate_response():
            state = multi_turn_question.run(
                request.messages, request.configuration, stream=True
            )

            async for chunk in state.text_async_iter(var_name="response"):
                yield f"data: {chunk}\n\n"
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
