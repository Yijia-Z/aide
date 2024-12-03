# backend/service/startup.py

import logging
import os
from backend.service.tool_utils import load_tools_from_db
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# 全局 Supabase 客户端实例
supabase: Client = None

def get_supabase_client() -> Client:
    global supabase
    if supabase is None:
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_KEY = os.getenv("SUPABASE_KEY")
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL or KEY not found in environment variables.")
            raise ValueError("Supabase URL or KEY not found.")
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

def startup_event():
    """
    加载工具并初始化 Supabase 客户端
    """
    logger.info("Starting up and loading tools from MongoDB...")
    load_tools_from_db()
    logger.info("Tools successfully loaded.")

    logger.info("Initializing Supabase client...")
    get_supabase_client()
    logger.info("Supabase client initialized.")
