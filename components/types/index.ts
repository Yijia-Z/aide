export interface KeyInfo {
  data: {
    label: string;
    usage: number;            // 已使用多少 credits
    limit: number | null;     // 如果是 null，表示无限制
    is_free_tier: boolean;
    rate_limit: {
      requests: number;       // 每秒可发请求数
      interval: string;       // 时间区间，如 "10s"
    };
  };
};

type TextContent = {
  type: "text";
  text: string;
};

type ImageContentPart = {
  type: "image_url";
  image_url: {
    url: string; // URL or base64 encoded image data
    detail?: string; // Optional, defaults to "auto"
  };
};

export type ContentPart = TextContent | ImageContentPart;

export interface Message {
  id: string;
  content: string | ContentPart[];
  publisher: "user" | "ai";
  userName?: string;
  modelId?: string;
  modelConfig?: Partial<Model>;
  replies: Message[];
  isCollapsed: boolean;
  userCollapsed: boolean;
}
export interface InviteData {
  email: string;
  role: "VIEWER" | "PUBLISHER" | "EDITOR" | "OWNER";
}
export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
  role?: string;
  updatedAt?: string;
  hasFetchedMessages?: boolean;
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
  type: string;
  name: string;
  description: string;
  script?: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export type ToolChoice = "auto" | "none" | "required" | { type: "function"; function: { name: string } };


export interface UserProfile {
  id: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
}
