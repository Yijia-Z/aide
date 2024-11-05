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
  tool_choice?: string | { type: string; function: { name: string } };
}
