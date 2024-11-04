# backend/services/chat_s.py

import os
import json
import aiohttp
from fastapi import HTTPException, Request
from starlette.responses import StreamingResponse
from typing import Any, Dict, List
from backend.models import ChatRequest
from backend.services.tool_s import ToolService  # 确保导入正确

tool_service = ToolService()  # 在这里创建实例

async def fetch_chat_completion(params: Dict[str, Any]) -> aiohttp.ClientResponse:
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
            "HTTP-Referer": os.getenv('NEXT_PUBLIC_APP_URL', "http://aide.zy-j.com"),
            "X-Title": "Aide",
        }
        url = f"{os.getenv('NEXT_PUBLIC_OPENROUTER_API_URL')}/chat/completions"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(status_code=response.status, detail=error_text)
                return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def process_chat(request: Request):
    try:
        body = await request.json()
        messages = body.get('messages', [])
        configuration = body.get('configuration', {})
        if not os.getenv('OPENROUTER_API_KEY'):
            raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY 未设置")

        params = {
            "messages": messages,
            "model": configuration.get('model'),
            "temperature": configuration.get('temperature'),
            "max_tokens": configuration.get('max_tokens'),
            "top_p": configuration.get('top_p'),
            "frequency_penalty": configuration.get('frequency_penalty'),
            "presence_penalty": configuration.get('presence_penalty'),
            "repetition_penalty": configuration.get('repetition_penalty'),
            "min_p": configuration.get('min_p'),
            "top_a": configuration.get('top_a'),
            "seed": configuration.get('seed'),
            "context_length": configuration.get('context_length'),
            "top_k": configuration.get('top_k'),
            "logit_bias": configuration.get('logit_bias'),
            "logprobs": configuration.get('logprobs'),
            "top_logprobs": configuration.get('top_logprobs'),
            "response_format": configuration.get('response_format'),
            "stop": configuration.get('stop'),
            "tools": configuration.get('tools'),
            "tool_choice": configuration.get('tool_choice', 'auto'),
            "stream": False,
        }

        # 初始请求，检查是否有工具调用
        initial_response = await fetch_chat_completion(params)
        initial_data = await initial_response.json()
        assistant_message = initial_data['choices'][0].get('message', {})
        if assistant_message:
            messages.append(assistant_message)

        # 处理工具调用
        tool_calls = assistant_message.get('tool_calls', [])
        if tool_calls:
            for tool_call in tool_calls:
                tool_result = await tool_service.handle_tool_call(tool_call)
                # 添加工具结果消息
                messages.append({
                    "role": "tool",
                    "name": tool_call['function']['name'],
                    "tool_call_id": tool_call['id'],
                    "content": json.dumps(tool_result),
                })
            # 更新请求参数
            params['messages'] = messages

        # 设置为流式响应
        params['stream'] = True

        # 最终请求，获取流式响应
        final_response = await fetch_chat_completion(params)
        # 不需要在这里关闭 tool_service

        # 返回 StreamingResponse
        return StreamingResponse(stream_generator(final_response), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def stream_generator(response: aiohttp.ClientResponse):
    try:
        async for line in response.content:
            yield line
    except Exception as e:
        yield f"data: [ERROR] {str(e)}\n\n"
