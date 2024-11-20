# backend/service/model_utils.py
import json
from typing import List, Dict
from pathlib import Path
from backend.service.db_utils import clientdb  # 引入数据库客户端
import logging

logger = logging.getLogger(__name__)
models_list: List[Dict] = []

def load_models_from_file():
    global models_list
    models_file = Path(__file__).parent.parent / "models.json"
    try:
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
            }
        }
    ]
