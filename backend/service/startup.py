# backend/service/startup.py

from backend.service.tool_utils import load_tools_from_db
import logging

logger = logging.getLogger(__name__)

def startup_event():
    """
    加载工具
    """
    logger.info("Starting up and loading tools from database...")
    load_tools_from_db()
    logger.info("Tools successfully loaded.")
