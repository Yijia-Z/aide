# backend/service/db_utils.py
import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import logging
from pathlib import Path

# 日志设置
logger = logging.getLogger(__name__)

# 加载环境变量
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent.parent  # 修改路径到项目根目录
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
