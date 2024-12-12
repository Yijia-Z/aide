# backend/service/tool_utils.py
from typing import List, Dict, Any 
from service.db_utils import clientdb  # 引入数据库客户端
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

tools_list: List[Dict] = []

def load_tools_from_db():
    global tools_list
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
    except Exception as e:
        logger.error(f"Failed to load tools: {str(e)}")
        tools_list = get_default_tools()
        save_tools_to_db(tools_list)

def save_tools_to_db(tools: List[Dict]):
    try:
        db = clientdb["threaddata"]
        collection = db["tools"]
        collection.delete_many({})
        collection.insert_many(tools)
        logger.info("Tools successfully saved to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to save tools to MongoDB: {str(e)}")

def get_default_tools() -> List[Dict]:
    # 返回默认工具列表
    return [
        {
            "name": "Get Current Weather",
            "description": "Provides the current weather for a specified location.",
            "enabled": True,
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g., San Francisco, CA",
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                        },
                    },
                    "required": ["location"],
                },
            },
        },
        # 更多默认工具
    ]
def serialize_tool(tool: Dict[str, Any]) -> Dict[str, Any]:
    """
    Serialize tool data, handling non-serializable fields like ObjectId.

    Parameters:
    - tool: Tool dictionary.

    Returns:
    - Serialized tool dictionary.
    """
    serialized = {}
    for key, value in tool.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
        elif isinstance(value, dict):
            serialized[key] = serialize_tool(value)  # Recursive handling
        elif isinstance(value, list):
            serialized[key] = [serialize_tool(item) if isinstance(item, dict) else item for item in value]
        else:
            serialized[key] = value
    return serialized