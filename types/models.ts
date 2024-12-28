// types/models.ts
export interface ThreadsRouteContext {
  // params 里声明所有我们需要的路由参数
  params: {
    id: string; 
    // 如果还有别的，比如 [slug], [xyz]，也都可以一起定义
  };
  // 如果你还想拿 searchParams，可自定义:
  // searchParams?: { [key: string]: string | string[] | undefined };
}
export interface Thread {
  id: string;             // String @id (主键)
  title: string;          // 线程标题
  isPinned?: boolean;     // 是否置顶(可选)
  updatedAt?: string;     
  createdAt?: string;     
  
}

//在完成supabase前临时用
export interface ThreadData {
  threadId: string;
  thread: Record<string, any>; // 或者更具体一些
  // ...
}
export type ThreadUpdateData = Partial<Thread>;
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
  