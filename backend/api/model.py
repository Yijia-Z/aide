# api/models_api.py

from fastapi import APIRouter, Request, HTTPException
from backend.models import ModelData
from typing import List
from backend.services.model_s import save_models, load_models
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/api/save_models")
async def save_models_api(request: Request):
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided")
        models_list = [ModelData(**model) for model in models]
        await save_models(models_list)
        return {"status": "success"}
    except HTTPException as e:
        logger.error(f"HTTPException in save_models_api: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Failed to save models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/load_models")
async def load_models_api():
    try:
        models = await load_models()
        models_dicts = [model.dict() for model in models]
        return {"models": models_dicts}
    except HTTPException as e:
        logger.error(f"HTTPException in load_models_api: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
