from fastapi import APIRouter, HTTPException
from backend.models import ThreadData

from backend.services.thread_s import save_thread_to_db, load_threads_from_db, delete_thread_from_db

router = APIRouter()

@router.post("/api/save_thread")
async def save_thread(thread_data: ThreadData):
    try:
        await save_thread_to_db(thread_data)
        return {"status": "success"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/load_threads")
async def load_threads():
    try:
        threads = await load_threads_from_db()
        return {"threads": threads}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/delete_thread/{thread_id}")
async def delete_thread(thread_id: str):
    try:
        await delete_thread_from_db(thread_id)
        return {"status": "success"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
