# main.py
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import router as api_router
from service.startup import startup_event


# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 初始化 FastAPI 应用
app = FastAPI()
app.include_router(api_router)
# 设置中间件
origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含来自 api.py 的路由
app.include_router(api_router)

# 添加启动事件处理程序
app.add_event_handler("startup", startup_event)

if __name__ == "__main__":
    import uvicorn

    logger.info("API key loaded.")
    logger.info(f"Allowed origins: {allowed_origins}")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
