# backend/models.py
from pydantic import BaseModel
from typing import List, Dict, Optional, Union

class Message(BaseModel):
    role: str
    content: Optional[str] = None

class Configuration(BaseModel):
    model: str
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    top_k: Optional[int] = None
    stop: Optional[Union[str, List[str]]] = None
    logit_bias: Optional[Dict[str, float]] = None
    top_a: Optional[float] = None
    seed: Optional[int] = None
    context_length: Optional[int] = None
    min_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    logprobs: Optional[int] = None
    top_logprobs: Optional[int] = None
    response_format: Optional[Dict] = None
    tools: Optional[List] = None
    tool_choice: Optional[Union[str, Dict]] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    configuration: Configuration

class ThreadData(BaseModel):
    threadId: str
    thread: Dict

class ChatResponse(BaseModel):
    response: str

class Model(BaseModel):
    id: str
    name: str
    baseModel: str
    systemPrompt: str
    parameters: Configuration

class FunctionParameters(BaseModel):
    type: str
    properties: Dict[str, Dict]
    required: List[str]

class Function(BaseModel):
    name: str
    description: str
    parameters: FunctionParameters

class Tool(BaseModel):
    name: str
    description: str
    enabled: bool
    type: str
    function: Function

class ToolUseResponse(BaseModel):
    role: str
    name: str
    tool_call_id: str
    content: str

class ToolUseRequest(BaseModel):
    tool_name: str
    tool_args: dict
    tool_call_id: str
