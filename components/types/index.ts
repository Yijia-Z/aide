export interface Message {
  id: string;
  content: string;
  publisher: "user" | "ai";
  modelId?: string;
  modelConfig?: Partial<Model>;
  replies: Message[];
  isCollapsed: boolean;
  userCollapsed: boolean;
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
}

export interface Model {
  id: string;
  name: string;
  baseModel: string;
  systemPrompt: string;
  parameters: ModelParameters;
}

export interface ModelParameters {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;
  max_tokens?: number;
  max_output?: number;
  context_length?: number;
  logit_bias?: { [key: string]: number };
  logprobs?: boolean;
  top_logprobs?: number;
  response_format?: { type: string };
  stop?: string[];
  tools?: any[];
  tool_choice?: ToolChoice;
  supported_parameters?: any;
}

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: string;
  function: ToolFunction;
}

export type ToolChoice = "auto" | "none" | "required" | { type: "function"; function: { name: string } };


// types/models.ts

export interface UserProfile {
  id: string;        
  username?: string;  
  createdAt: string;  
  updatedAt: string;  
}
