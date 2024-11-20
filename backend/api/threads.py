# backend/api/threads.py
from fastapi import APIRouter, HTTPException
from backend.models import ThreadData
from backend.service.db_utils import clientdb
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/save_thread")
async def save_thread_endpoint(thread_data: ThreadData):
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread
        db = clientdb["threaddata"] 
        collection_name = f"thread_{thread_id}" 
        collection = db[collection_name]
        
        collection.update_one(
            {"threadId": thread_id},
            {"$set": thread},
            upsert=True
        )
        
        logger.info(f"Successfully saved thread {thread_id}.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save thread to MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save thread.")

@router.get("/load_threads")
async def load_threads_endpoint():
    try:
        db = clientdb["threaddata"]
        collections = db.list_collection_names() 
        
        threads = []
        for collection_name in collections:
            if collection_name.startswith("thread_"):
                collection = db[collection_name]
                thread = collection.find_one({}, {"_id": 0}) 
                if thread:
                    threads.append(thread)
        logger.info(f"Successfully loaded {len(threads)} threads from MongoDB.")
        return {"threads": threads}
    except Exception as e:
        logger.error(f"Failed to load threads from MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load threads.")

@router.delete("/delete_thread/{thread_id}")
async def delete_thread_endpoint(thread_id: str):
    try:
        db = clientdb["threaddata"]
        collection_name = f"thread_{thread_id}"
        
        # Check if collection exists before attempting deletion
        if collection_name in db.list_collection_names():
            db.drop_collection(collection_name)
            logger.info(f"Successfully deleted thread {thread_id}.")
            return {"status": "success"}
        else:
            logger.warning(f"Thread {thread_id} not found.")
            raise HTTPException(status_code=404, detail="Thread not found.")
            
    except Exception as e:
        logger.error(f"Failed to delete thread from MongoDB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete thread.")
