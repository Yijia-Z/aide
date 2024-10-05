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

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 .env 文件中的环境变量
load_dotenv()

app = FastAPI()

# 允许的前端地址，确保根据实际情况调整
origins = [
    "http://localhost:3000",  # 前端开发服务器地址
    # 添加其他允许的来源
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 允许的来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定义可用模型及其配置
models = {
    'gpt-4': {
        'model_name': 'gpt-4',
        'max_tokens': 150,
    },
    'gpt-3.5-turbo': {
        'model_name': 'gpt-3.5-turbo',
        'max_tokens': 150,
    },
    'gpt-4o-mini': {  # 新增的模型配置
        'model_name': 'gpt-4o-mini',
        'max_tokens': 150,
    },
    # 根据需要添加更多模型
}

# 从环境变量中加载 OpenAI API 密钥
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logger.error("请在环境变量中设置 OPENAI_API_KEY。")
    raise RuntimeError("请在环境变量中设置 OPENAI_API_KEY。")

# 设置 sglang 的默认后端为 OpenAI（移除 temperature，添加 model_name）
sgl.set_default_backend(sgl.OpenAI(api_key=openai_api_key, model_name="gpt-4"))

# 定义消息模型
class Message(BaseModel):
    role: str
    content: str

# 定义配置模型
class Configuration(BaseModel):
    model: str  # 模型名称，如 'gpt-4' 或 'gpt-3.5-turbo'
    max_tokens: int

# 定义请求数据模型
class ChatRequest(BaseModel):
    messages: List[Message]  # 消息数组
    configuration: Configuration  # 配置对象

# 定义响应数据模型
class ChatResponse(BaseModel):
    response: str

# 使用 sglang 构建多轮问答的上下文
@sgl.function
def multi_turn_question(s, messages: List[Message], model: str, max_tokens: int):
    # 设置模型的系统提示词
    s += sgl.system("You are a helpful assistant.")
    
    # 遍历传入的消息，并将它们添加到上下文中
    for msg in messages:
        if msg.role == "system":
            s += sgl.system(msg.content)
        elif msg.role == "user":
            s += sgl.user(msg.content)
        elif msg.role == "assistant":
            s += sgl.assistant(msg.content)
    
    # 生成助手的回应
    s += sgl.assistant(sgl.gen("response", max_tokens=max_tokens))

@app.get("/api/connect")
async def connect():
    logger.info("后端：前端已连接。")
    return JSONResponse(content={"message": "连接成功"}, status_code=200)

@app.get("/api/models", response_model=List[Configuration])
async def get_models():
    logger.info("后端：获取模型列表。")
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
        # 读取并打印原始请求体
        body = await req.body()
        logger.info("recv raw data:")
        logger.info(body.decode('utf-8'))

        # 打印解析后的请求对象
        logger.info("recv req:")
        logger.info(request.json())

        # 打印收到的模型 ID 和可用模型
        logger.info(f"Received model ID from req: {request.configuration.model}")
        logger.info(f"Available models those def above: {list(models.keys())}")

        # 验证模型 ID 是否有效
        if request.configuration.model not in models:
            logger.error("Invalid model ID received.")
            raise HTTPException(status_code=400, detail="Invalid model ID")

        # 调用 sglang 函数，传递消息数组和模型配置（移除 temperature）bc of sglang
        response = multi_turn_question.run(
            messages=request.messages,
            model=request.configuration.model,
            max_tokens=request.configuration.max_tokens
        )

        # 打印生成的响应
        logger.info("resp:")
        logger.info(response["response"])

        return ChatResponse(response=response["response"])

    except HTTPException as he:
        logger.error(f"HTTPException: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"错误信息：{str(e)}")
        traceback.print_exc()  # 打印完整堆栈跟踪
        raise HTTPException(status_code=500, detail="服务器错误")

# 启动服务器
if __name__ == "__main__":
    logger.info("启动 FastAPI 服务器...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    logger.info("Loaded API Key:", openai_api_key)
