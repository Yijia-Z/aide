# backend/api/tools_support.py
from fastapi import APIRouter, HTTPException
from service.db_utils import clientdb
from service.tool_utils import serialize_tool
import httpx
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/check_model_tools_support/{model_id}")
async def check_model_tools_support(model_id: str):
    """
    检查模型是否支持工具。
    """
    try:
        logger.info(f"Received request to check model tool support, model_id {model_id}")
        dbm = clientdb["threaddata"]  # 连接到 MongoDB 数据库
        dbms = dbm["models"]  # 使用 models 集合
        dbls = dbm["tools"]  # 使用 tools 集合

        # 在数据库中查找模型
        model = dbms.find_one({"id": model_id})
        if not model:
            logger.error(f"Model not found: {model_id}")
            raise HTTPException(status_code=404, detail="Model not found.")

        # 获取 OpenRouter 中的实际模型 ID
        basemodel = model.get("baseModel")
        if not basemodel:
            logger.error(f"Model {model_id} does not have a 'basemodel' field configured.")
            raise HTTPException(status_code=400, detail="Model does not have 'basemodel' field configured.")

        logger.info(f"Model {model_id} basemodel {basemodel}")

        # 获取 OpenRouter API 密钥
        openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if not openrouter_api_key:
            logger.error("Missing OPENROUTER_API_KEY environment variable.")
            raise RuntimeError("Missing OPENROUTER_API_KEY.")

        headers = {
            'Authorization': f'Bearer {openrouter_api_key}',
            'Content-Type': 'application/json',
        }

        # 构建请求 URL
        openrouter_url = f'https://openrouter.ai/api/v1/parameters/{basemodel}'
        logger.info(f"Sending request to OpenRouter Parameters API {openrouter_url}, Headers {headers}")

        async with httpx.AsyncClient() as client:
            response = await client.get(openrouter_url, headers=headers)

        logger.info(f"Received response from OpenRouter Parameters API, Status Code {response.status_code}")

        if response.status_code != 200:
            logger.error(f"OpenRouter Parameters API error {response.status_code} - {response.text}")
            return {"supportsTools": False}
        
        data = response.json()
        logger.debug(f"OpenRouter Parameters API response body {data}")

        supported_parameters = data.get('data', {}).get('supported_parameters', [])
        supports_tools = 'tools' in supported_parameters

        logger.info(f"Does model {model_id} support tools: {supports_tools}")

        if supports_tools:
            # 从数据库加载工具
            tools = list(dbls.find({}))
            serialized_tools = [serialize_tool(tool) for tool in tools]
            logger.info(f"Loaded {len(serialized_tools)} tools.")
            return {"supportsTools": True, "tools": serialized_tools}
        else:
            logger.info(f"Model {model_id} does not support tools.")
            return {"supportsTools": False}

    except Exception as e:
        logger.error(f"Error checking model tool support: {str(e)}")
        return {"supportsTools": False}
