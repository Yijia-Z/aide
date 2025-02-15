// types/models.ts

export interface Thread {
  id: string;         
  title: string;         
      
  updatedAt?: string;     
  createdAt?: string;     
  messages?: Message[];  
}
export interface Message {
  id: string;
  content: string | ContentPart[];
  publisher: "user" | "ai";
  userName?:string;
  modelId?: string;
  modelConfig?: Partial<ModelData>;
  replies: Message[];
  isCollapsed: boolean;
  userCollapsed: boolean;
}
export type ContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: string;
      };
    };
export interface ThreadData {
  threadId: string;
  thread: Record<string, any>; 
  // ...
}
export type ThreadUpdateData = Partial<Thread>;

  export interface ModelData {
    id: string;
    name: string;
    baseModel: string;
    systemPrompt: string;
    parameters: Record<string, unknown>; 
  }
  
  export interface Tool {
    name: string;
    description: string;
    enabled: boolean;
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }
  
  export interface ToolUseRequest {
    tool_name: string;
    tool_args: Record<string, unknown>;
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
  export interface ThreadRole {
    email: string;
    role: "VIEWER" | "PUBLISHER" |  "EDITOR" | "OWNER";
  }
  