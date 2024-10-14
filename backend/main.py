import os
from typing import List
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse

import sglang as sgl
from dotenv import load_dotenv
import traceback
import logging
from pathlib import Path
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
        logger.info(request.model_dump_json())

        logger.info(f"Received model ID from req: {request.configuration.model}")
        logger.info(f"Available models those def above: {list(models.keys())}")

        if request.configuration.model not in models:
            logger.error("Invalid model ID received.")
            raise HTTPException(status_code=400, detail="Invalid model ID")

        async def generate_response():
            state = multi_turn_question.run(
                request.messages,
                request.configuration.model,
                request.configuration.max_tokens,
                request.configuration.temperature,
                stream=True
            )

            async for chunk in state.text_async_iter(var_name="response"):
                yield f"data: {chunk}\n\n"

            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_response(), media_type="text/event-stream")

    except HTTPException as he:
        logger.error(f"HTTPException: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Error message: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error from backend")

# 启动服务器
if __name__ == "__main__":
    logger.info("start FastAPI server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    logger.info("Loaded API Key:", openai_api_key)
