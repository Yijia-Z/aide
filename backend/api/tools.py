# backend/api/tools.py
from fastapi import APIRouter, HTTPException, Request
from service.tool_utils import save_tools_to_db, load_tools_from_db, get_default_tools, serialize_tool
from service.db_utils import clientdb
from models import Tool
import logging
from models import Tool, ToolUseRequest
from service.process_tool_use import process_tool_use_function
router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/save_tools")
async def save_tools_endpoint(request: Request):
    try:
        data = await request.json()
        tools = data.get("tools")
        if tools is None:
            raise HTTPException(status_code=400, detail="No tool data provided.")
        
        for tool in tools:
            try:
                Tool(**tool)
            except Exception as e:
                logger.error(f"Tool data validation failed: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Tool data validation failed: {str(e)}")
        
        save_tools_to_db(tools)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save tools.")

@router.get("/load_tools")
async def load_tools_endpoint():
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        tools_from_db = list(collection.find({}, {"_id": 0}))
        
        if not tools_from_db:
            logger.warning("No tools found in the database. Initializing with default tools.")
            tools_list = get_default_tools()
            save_tools_to_db(tools_list)
        else:
            logger.info(f"Successfully loaded {len(tools_from_db)} tools from MongoDB.")
            tools_list = tools_from_db
        
        return {"tools": tools_list}
    except Exception as e:
        logger.error(f"Failed to load tools: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load tools.")
    
@router.post("/process_tool_use")
async def process_tool_use_endpoint(request: ToolUseRequest):
    """
    处理工具的使用。
    """
    try:
        response = await process_tool_use_function(request)
        return response
    except Exception as e:
        logger.error(f"Failed to process tool use: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process tool use.")