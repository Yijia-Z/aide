import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from backend.models import ThreadData
from backend.core.config import settings
from fastapi import HTTPException

mongo_url = os.getenv("MONGODB_URI", "")
client = MongoClient(mongo_url, server_api=ServerApi('1'))
db = client["threaddata"]

async def save_thread_to_db(thread_data: ThreadData):
    try:
        thread_id = thread_data.threadId
        thread = thread_data.thread
        collection_name = f"thread_{thread_id}"
        collection = db[collection_name]
        collection.update_one(
            {"threadId": thread_id},
            {"$set": thread},
            upsert=True
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save thread: {str(e)}")

async def load_threads_from_db():
    try:
        collections = db.list_collection_names()
        threads = []
        for collection_name in collections:
            if collection_name.startswith("thread_"):
                collection = db[collection_name]
                thread = collection.find_one({}, {"_id": 0})
                if thread:
                    threads.append(thread)
        return threads
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load threads: {str(e)}")

async def delete_thread_from_db(thread_id):
    try:
        collection_name = f"thread_{thread_id}"
        if collection_name in db.list_collection_names():
            db.drop_collection(collection_name)
        else:
            raise HTTPException(status_code=404, detail=f"Thread {thread_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete thread: {str(e)}")
