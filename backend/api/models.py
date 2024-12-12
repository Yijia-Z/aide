# backend/api/models.py
from fastapi import APIRouter, HTTPException, Request
from service.db_utils import clientdb
from service.model_utils import load_models_from_file, get_default_models, models_list
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/save_models")
async def save_models_endpoint(request: Request):
    try:
        data = await request.json()
        models = data.get("models")
        if models is None:
            raise HTTPException(status_code=400, detail="No model data provided.")
        
        db = clientdb["threaddata"]
        collection = db["models"]
        collection.delete_many({})
        collection.insert_many(models)
        
        logger.info("Models successfully saved to MongoDB.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save models to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save models.")

@router.get("/load_models")
async def load_models_endpoint():
    try:
        db = clientdb["threaddata"]
        collection = db["models"]
        models_from_db = list(collection.find({}, {"_id": 0}))
        
        if not models_from_db:
            logger.warning("No models found in the database. Attempting to load from file.")
            load_models_from_file()
            if not models_list:
                logger.warning("No models found in file either. Initializing with default models.")
                models_list = get_default_models()
        else:
            logger.info(f"Successfully loaded {len(models_from_db)} models from MongoDB.")
            models_list = models_from_db
        return {"models": models_list}
    except Exception as e:
        logger.error(f"Failed to load models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load models from database or file.")
