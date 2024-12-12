import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import logging
from pathlib import Path

# 日志设置
logger = logging.getLogger(__name__)

# 只在开发环境中加载.env文件
if not os.getenv("MONGODB_URI"):
    current_dir = Path(__file__).resolve().parent
    parent_dir = current_dir.parent.parent
    dotenv_path = parent_dir / ".env.local"

    if not dotenv_path.exists():
        logger.warning(f".env.local file not found at {dotenv_path}, attempting to load from default .env")
        dotenv_path = parent_dir / ".env"
        
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path)

mongo_url = os.getenv("MONGODB_URI")
if not mongo_url:
    logger.error("MONGODB_URI is not set in environment variables.")
    raise RuntimeError("Missing MONGODB_URI.")

clientdb = MongoClient(mongo_url, server_api=ServerApi('1'))