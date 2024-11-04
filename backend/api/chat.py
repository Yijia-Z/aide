# backend/api/chat.py

from fastapi import APIRouter, HTTPException, Request
from backend.models import ChatRequest
from backend.services.chat_s import process_chat
from pydantic import ValidationError
import logging

router = APIRouter()

@router.post("/api/chat")
async def chat_endpoint(chat_request: ChatRequest):
    try:
        logger.info(f"Received chat request: {chat_request}")
        response = await process_chat(chat_request)
        logger.info(f"Generated response: {response}")
        return response
    except ValidationError as e:
        logger.error(f"Validation error in chat request: {e.errors()}")
        raise HTTPException(status_code=422, detail=e.errors())
    except HTTPException as e:
        logger.error(f"HTTPException in chat_endpoint: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in chat_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {str(e)}")
