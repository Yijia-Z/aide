# backend/service/process_tool_use.py

import os
import sys
import importlib
import traceback
import json
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

async def process_tool_use_function(request):
    tool_name = request.tool_name
    tool_args = request.tool_args
    tool_call_id = request.tool_call_id

    # 假设工具函数位于 'tool_functions' 目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    tool_functions_dir = os.path.join(current_dir, '..', 'functions') 
    # 将工具函数目录添加到 sys.path
    if tool_functions_dir not in sys.path:
        sys.path.append(tool_functions_dir)
        logger.info(f"Added {tool_functions_dir} to sys.path")

    try:
        # 动态导入模块，假设模块名与 tool_name 相同
        module = importlib.import_module(tool_name)
    except ImportError as e:
        error_message = f"未找到工具 '{tool_name}'。"
        logger.error(error_message)
        raise HTTPException(status_code=404, detail=error_message)

    try:
        # 获取模块中的函数
        if hasattr(module, tool_name):
            function = getattr(module, tool_name)
        elif hasattr(module, 'run'):
            function = getattr(module, 'run')
        elif hasattr(module, 'execute'):
            function = getattr(module, 'execute')
        else:
            error_message = f"在工具 '{tool_name}' 中未找到可执行的函数。"
            logger.error(error_message)
            raise HTTPException(status_code=500, detail=error_message)
    except Exception as e:
        error_message = f"获取工具 '{tool_name}' 中的函数时出错：{str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)

    try:
        # 执行函数，传入 tool_args 作为关键字参数
        result = function(**tool_args)
        logger.info(f"Executed function '{tool_name}' with args {tool_args}, result: {result}")
    except Exception as e:
        # 捕获并记录异常
        traceback_str = ''.join(traceback.format_exception(None, e, e.__traceback__))
        error_message = f"执行工具 '{tool_name}' 时出错：{str(e)}\n{traceback_str}"
        logger.error(error_message)
        # 返回错误信息
        return {
            'role': 'tool',
            'name': tool_name,
            'tool_call_id': tool_call_id,
            'content': json.dumps({'error': error_message}, ensure_ascii=False),
        }

    # 将结果转换为 JSON 字符串（如果需要）
    if not isinstance(result, str):
        result = json.dumps(result, ensure_ascii=False)

    # 返回成功结果
    return {
        'role': 'tool',
        'name': tool_name,
        'tool_call_id': tool_call_id,
        'content': result,
    }
