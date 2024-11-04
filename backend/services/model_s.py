# services/model_service.py

import os
import json
from pathlib import Path
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from typing import List
from backend.models import ModelData
from fastapi import HTTPException
import logging
from backend.core.config import settings
logger = logging.getLogger(__name__)

mongo_url = os.getenv("MONGODB_URI", "")
client = MongoClient(mongo_url, server_api=ServerApi('1'))
db = client["threaddata"]
model_collection = db["models"]

async def save_models(models: List[ModelData]):
    try:
        model_collection.delete_many({})
        model_dicts = [model.dict() for model in models]
        model_collection.insert_many(model_dicts)
        logger.info("Models successfully saved to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to save models to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save models: {str(e)}")

async def load_models() -> List[ModelData]:
    try:
        models_from_db = list(model_collection.find({}, {"_id": 0}))
        if not models_from_db:
            logger.warning("No models found in the database. Attempting to load from file.")
            models_from_file = load_models_from_file()
            if models_from_file:
                # 将从文件加载的模型保存到数据库
                await save_models(models_from_file)
                return models_from_file
            else:
                # 如果文件中也没有模型，返回默认模型
                logger.warning("No models found in file either. Initializing with default models.")
                default_models = get_default_models()
                # 将默认模型保存到数据库
                await save_models(default_models)
                return default_models
        else:
            logger.info(f"Successfully loaded {len(models_from_db)} models from MongoDB.")
            return [ModelData(**model) for model in models_from_db]
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load models: {str(e)}")

def load_models_from_file() -> List[ModelData]:
    try:
        # 假设模型文件位于项目根目录下的 models.json
        models_file_path = Path(__file__).parent.parent / "models.json"
        if models_file_path.exists():
            with models_file_path.open("r", encoding="utf-8") as f:
                try:
                    models_list = json.load(f)
                    if not models_list:
                        logger.warning("models.json is empty.")
                        return []
                    else:
                        logger.info("Models loaded from file.")
                        return [ModelData(**model) for model in models_list]
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse models.json: {str(e)}")
                    return []
        else:
            logger.warning(f"models.json not found at {models_file_path}")
            return []
    except Exception as e:
        logger.error(f"Failed to load models from file: {str(e)}")
        return []

def get_default_models() -> List[ModelData]:
    """Return default model configuration."""
    default_model = ModelData(
        id="default-model-id",
        name="Default Model",
        baseModel="openai/gpt-4o-2024-08-06",
        systemPrompt="You are a helpful assistant.",
        parameters={
            "temperature": 0.7,
            "max_tokens": 512,
        }
    )
    return [default_model]
