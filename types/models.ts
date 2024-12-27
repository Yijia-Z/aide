// types/models.ts

export interface ThreadData {
    threadId: string;
    thread: Record<string, any>;
  }
  
  export interface ModelData {
    id: string;
    name: string;
    baseModel: string;
    systemPrompt: string;
    parameters: Record<string, any>; 
  }
  
  export interface Tool {
    name: string;
    description: string;
    enabled: boolean;
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }
  
  export interface ToolUseRequest {
    tool_name: string;
    tool_args: Record<string, any>;
    tool_call_id: string;
  }
  
  export interface ToolUseResponse {
    role: string;
    name: string;
    tool_call_id: string;
    content: string;
  }
  export interface UserProfile {
    id: string;        
    username?: string;  
    createdAt: string;  
    updatedAt: string;  
  }
  