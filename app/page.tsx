"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";
import debounce from "lodash.debounce";

import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash,
  ListPlus,
  MessageSquare,
  X,
  Plus,
  Check,
  MessageSquarePlus,
  Pin,
  PinOff,
  Sparkle,
  Copy,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectBaseModel } from "@/components/ui/select-model";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

const MESSAGE_INDENT = 24; // Constant value for indentation

const DEFAULT_MODEL: Model = {
  id: 'default',
  name: 'Default Model',
  baseModel: 'meta-llama/llama-3.2-3b-instruct:free',
  systemPrompt: 'You are a helpful assistant.',
  parameters: {
    temperature: 0.7,
    top_p: 1,
    max_tokens: 1000,
  },
};

interface Message {
  id: string;
  content: string;
  publisher: "user" | "ai";
  modelName?: string;
  replies: Message[];
  isCollapsed: boolean;
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
  isPinned: boolean;
}

interface Model {
  id: string;
  name: string;
  baseModel: string;
  systemPrompt: string;
  parameters: ModelParameters;
}

interface ModelParameters {
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

// Helper function to find a message and its parents
function findMessageAndParents(
  messages: Message[],
  targetId: string,
  parents: Message[] = []
): [Message | null, Message[]] {
  for (const message of messages) {
    if (message.id === targetId) {
      return [message, parents];
    }
    const [found, foundParents] = findMessageAndParents(message.replies, targetId, [...parents, message]);
    if (found) return [found, foundParents];
  }
  return [null, []];
}

// Recursive function to find all parent messages for a given message
function findAllParentMessages(
  threads: Thread[],
  currentThreadId: string | null,
  replyingToId: string | null
): Message[] {
  if (!currentThreadId || !replyingToId) return [];

  const currentThread = threads.find((thread) => thread.id === currentThreadId);
  if (!currentThread) return [];

  const [_, parentMessages] = findMessageAndParents(currentThread.messages, replyingToId);
  return parentMessages;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
console.log("API Base URL:", apiBaseUrl);

// Function to generate AI response
async function generateAIResponse(
  prompt: string,
  role: string,
  model: Model,
  threads: Thread[],
  currentThread: string | null,
  replyingTo: string | null
) {
  const requestPayload = {
    messages: [
      { role: "system", content: model.systemPrompt },
      ...findAllParentMessages(threads, currentThread, replyingTo).map(
        (msg) => ({
          role: msg.publisher === "user" ? "user" : "assistant",
          content: msg.content,
        })
      ),
      { role: role === "user" ? "user" : "assistant", content: prompt },
    ],
    configuration: {
      model: model.baseModel,
      temperature: model.parameters.temperature,
      top_p: model.parameters.top_p,
      top_k: model.parameters.top_k,
      frequency_penalty: model.parameters.frequency_penalty,
      presence_penalty: model.parameters.presence_penalty,
      repetition_penalty: model.parameters.repetition_penalty,
      min_p: model.parameters.min_p,
      top_a: model.parameters.top_a,
      seed: model.parameters.seed,
      max_tokens: model.parameters.max_tokens,
      logit_bias: model.parameters.logit_bias,
      logprobs: model.parameters.logprobs,
      top_logprobs: model.parameters.top_logprobs,
      response_format: model.parameters.response_format,
      stop: model.parameters.stop,
      tools: model.parameters.tools,
      tool_choice: model.parameters.tool_choice,
    },
  };

  console.log("Request payload:", JSON.stringify(requestPayload, null, 2));

  const response = await fetch(
    apiBaseUrl ? `${apiBaseUrl}/api/chat` : "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to generate AI response");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  return reader;
}

export default function ThreadedDocument() {
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models">(
    "threads"
  );

  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null);
  const [originalThreadTitle, setOriginalThreadTitle] = useState<string>("");
  const threadTitleInputRef = useRef<HTMLInputElement>(null);

  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const replyBoxRef = useRef<HTMLDivElement>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Focus on thread title input when editing
  useEffect(() => {
    if (editingThreadTitle && threadTitleInputRef.current) {
      threadTitleInputRef.current.focus();
    }
  }, [editingThreadTitle]);

  const startEditingThreadTitle = useCallback((threadId: string, currentTitle: string) => {
    setEditingThreadTitle(threadId);
    setOriginalThreadTitle(currentTitle);
  }, []);

  const confirmEditThreadTitle = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, title: newTitle } : thread
      )
    );
    setEditingThreadTitle(null);
    setOriginalThreadTitle(newTitle);  // Set the new title as the original
    saveThreadToBackend(threadId, { title: newTitle });
  }, []);

  const cancelEditThreadTitle = useCallback(() => {
    if (editingThreadTitle) {
      setThreads((prev: Thread[]) =>
        prev.map((thread) =>
          thread.id === editingThreadTitle
            ? { ...thread, title: originalThreadTitle }
            : thread
        )
      );
      setEditingThreadTitle(null);
      // No need to reset originalThreadTitle here
    }
  }, [editingThreadTitle, originalThreadTitle]);

  // Scroll to selected message
  useEffect(() => {
    if (selectedMessage) {
      const messageElement = document.getElementById(
        `message-${selectedMessage}`
      );
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  }, [selectedMessage]);

  // Scroll to reply box when replying
  useEffect(() => {
    if (replyBoxRef.current) {
      replyBoxRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [replyingTo]);

  // Connect to backend on component mount
  useEffect(() => {
    const connectToBackend = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/connect`, {
          method: "GET",
        });
        if (response.ok) {
          console.log("Connected to backend!");
          setIsConnected(true);
        } else {
          console.error("Failed to connect to backend.");
        }
      } catch (error) {
        console.error("Error connecting to backend:", error);
      } finally {
        setLastAttemptTime(Date.now());
      }
    };

    if (
      !isConnected &&
      (!lastAttemptTime || Date.now() - lastAttemptTime >= 5000)
    ) {
      connectToBackend();
    }

    const intervalId = setInterval(() => {
      if (!isConnected) {
        connectToBackend();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isConnected, lastAttemptTime]);

  const debouncedSaveThreads = useCallback(
    debounce(async (threadsToSave: Thread[]) => {
      try {
        const savePromises = threadsToSave.map((thread: Thread) =>
          fetch(
            apiBaseUrl ? `${apiBaseUrl}/api/save_thread` : "/api/save_thread",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ threadId: thread.id, thread }),
            }
          ).then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to save thread ${thread.id}`);
            }
            return response.json();
          })
        );

        const results = await Promise.all(savePromises);
        console.log(
          "All threads have been successfully saved to the backend.",
          results
        );
      } catch (error) {
        console.error("Failed to save threads:", error);
      }
    }, 2000), // 2 seconds
    [apiBaseUrl]
  );

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        const response = await fetch(
          apiBaseUrl ? `${apiBaseUrl}/api/load_threads` : "/api/load_threads",
          {
            method: "GET",
          }
        );
        if (response.ok) {
          const data = await response.json();
          console.log("Loaded threads data:", data.threads);
          const loadedThreads: Thread[] = data.threads.map((t: any) => ({
            id: t.threadId || t.id,
            title: t.thread?.title || t.title || "Untitled Thread",
            messages: t.thread?.messages || t.messages || [],
            isPinned: t.thread?.isPinned || t.isPinned || false,
          }));

          // Add a default thread if there are no threads
          if (loadedThreads.length === 0) {
            const defaultThread: Thread = {
              id: Date.now().toString(),
              title: "Welcome Thread",
              messages: [{
                id: Date.now().toString(),
                content: "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
                publisher: "ai",
                replies: [],
                isCollapsed: false,
              }],
              isPinned: false,
            };
            loadedThreads.push(defaultThread);
          }

          setThreads(loadedThreads);
          setCurrentThread(loadedThreads[0].id);
          console.log(`Successfully loaded ${loadedThreads.length} threads.`);
        } else {
          throw new Error("Failed to load thread data");
        }
      } catch (error) {
        console.error("Load failed:", error);
        // Create a default thread if loading fails
        const defaultThread: Thread = {
          id: Date.now().toString(),
          title: "Welcome Thread",
          messages: [{
            id: Date.now().toString(),
            content: "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
            publisher: "ai",
            replies: [],
            isCollapsed: false,
          }],
          isPinned: false,
        };
        setThreads([defaultThread]);
        setCurrentThread(defaultThread.id);
      }
    };

    loadThreads();
  }, []);

  useEffect(() => {
    debouncedSaveThreads(threads);
    return debouncedSaveThreads.cancel;
  }, [threads, debouncedSaveThreads]);

  // Add new thread
  const addThread = useCallback(async () => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: "New Thread",
      messages: [],
      isPinned: false,
    };
    setThreads((prev: Thread[]) => [...prev, newThread]);
    setCurrentThread(newThread.id);
    setEditingThreadTitle(newThread.id);
    setOriginalThreadTitle("New Thread");
  }, []);

  // Edit thread title
  const editThreadTitle = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, title: newTitle } : thread
      )
    );
    saveThreadToBackend(threadId, { title: newTitle });
  }, []);

  const saveThreadToBackend = async (
    threadId: string,
    updatedData: Partial<Thread>
  ) => {
    try {
      const response = await fetch(
        apiBaseUrl ? `${apiBaseUrl}/api/save_thread` : "/api/save_thread",
        {
          method: "POST", // 修改为 POST
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, thread: { ...updatedData } }), // 确保后端接收到正确的结构
        }
      );
      if (!response.ok) {
        throw new Error(`editthread ${threadId} fail`);
      }
    } catch (error) {
      console.error(`update ${threadId} datafail:`, error);
    }
  };

  // Add a new message to a thread
  const addMessage = useCallback(
    (
      threadId: string,
      parentId: string | null,
      content: string,
      publisher: "user" | "ai",
      newMessageId?: string
    ) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const model = models.find((m) => m.id === selectedModel);
          const newMessage: Message = {
            id: newMessageId || Date.now().toString(),
            content,
            publisher,
            modelName: publisher === "ai" ? model?.name : undefined,
            replies: [],
            isCollapsed: false,
          };
          setSelectedMessage(newMessage.id);

          const addReplyToMessage = (message: Message): Message => {
            if (message.id === parentId) {
              return { ...message, replies: [...message.replies, newMessage] };
            }
            return { ...message, replies: message.replies.map(addReplyToMessage) };
          };

          if (!parentId) {
            return { ...thread, messages: [...thread.messages, newMessage] };
          }

          return { ...thread, messages: thread.messages.map(addReplyToMessage) };
        })
      );
    },
    [models, selectedModel]
  );

  // Toggle message collapse state
  const toggleCollapse = useCallback((threadId: string, messageId: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const toggleMessage = (messages: Message[]): Message[] => {
          return messages.map((message) => {
            if (message.id === messageId) {
              return { ...message, isCollapsed: !message.isCollapsed };
            }
            return { ...message, replies: toggleMessage(message.replies) };
          });
        };
        return { ...thread, messages: toggleMessage(thread.messages) };
      })
    );
  }, []);

  // Delete a message
  const deleteMessage = useCallback(
    (threadId: string, messageId: string, deleteChildren: boolean) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;

          const removeMessage = (messages: Message[]): Message[] => {
            const [messageToDelete, parentMessages] = findMessageAndParents(messages, messageId);
            if (!messageToDelete) return messages;

            if (parentMessages.length === 0) {
              // Message is at the root level
              const newMessages = deleteChildren
                ? messages.filter((m) => m.id !== messageId)
                : [...messages.filter((m) => m.id !== messageId), ...messageToDelete.replies];

              // Set selection to the previous sibling or the first message
              if (newMessages.length > 0) {
                const index = messages.findIndex(m => m.id === messageId);
                const newSelectedId = index > 0 ? newMessages[index - 1].id : newMessages[0].id;
                setSelectedMessage(newSelectedId);
              } else {
                setSelectedMessage(null);
              }

              return newMessages;
            }

            // Message is nested
            const updateParent = (message: Message): Message => {
              if (message.id === parentMessages[parentMessages.length - 1].id) {
                const newReplies = deleteChildren
                  ? message.replies.filter((m) => m.id !== messageId)
                  : [...message.replies.filter((m) => m.id !== messageId), ...messageToDelete.replies];

                // Set selection to the parent
                setSelectedMessage(message.id);

                return {
                  ...message,
                  replies: newReplies,
                };
              }
              return { ...message, replies: message.replies.map(updateParent) };
            };

            return messages.map(updateParent);
          };

          return { ...thread, messages: removeMessage(thread.messages) };
        })
      );
    },
    [setSelectedMessage]
  );

  // Start editing a message
  const startEditingMessage = useCallback((message: Message) => {
    setEditingMessage(message.id);
    setEditingContent(message.content);
  }, []);

  // Cancel editing a message
  const cancelEditingMessage = useCallback(() => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        const removeEmptyMessage = (messages: Message[]): Message[] => {
          return messages.reduce((acc: Message[], message) => {
            if (message.id === editingMessage) {
              if (message.content.trim() === "") {
                return acc;
              }
            }
            return [
              ...acc,
              { ...message, replies: removeEmptyMessage(message.replies) },
            ];
          }, []);
        };
        return { ...thread, messages: removeEmptyMessage(thread.messages) };
      })
    );
    setEditingMessage(null);
    setEditingContent("");
  }, [editingMessage]);

  // Confirm editing a message
  const confirmEditingMessage = useCallback(
    (threadId: string, messageId: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const editMessage = (messages: Message[]): Message[] => {
            return messages.reduce((acc: Message[], message) => {
              if (message.id === messageId) {
                if (editingContent.trim() === "") {
                  return acc;
                }
                return [...acc, { ...message, content: editingContent }];
              }
              return [
                ...acc,
                { ...message, replies: editMessage(message.replies) },
              ];
            }, []);
          };
          return { ...thread, messages: editMessage(thread.messages) };
        })
      );
      setEditingMessage(null);
      setEditingContent("");
    },
    [editingContent]
  );

  // Add an empty reply to a message
  const addEmptyReply = useCallback(
    (threadId: string, parentId: string | null) => {
      const newMessageId = Date.now().toString();
      addMessage(threadId, parentId, "", "user", newMessageId);

      startEditingMessage({
        id: newMessageId,
        content: "",
        publisher: "user",
        replies: [],
        isCollapsed: false,
      });

      const newMessageElement = document.getElementById(
        `message-${newMessageId}`
      );
      if (newMessageElement) {
        newMessageElement.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    },
    [addMessage, startEditingMessage]
  );

  const findMessageById = useCallback(
    (messages: Message[], id: string): Message | null => {
      for (const message of messages) {
        if (message.id === id) return message;
        const found = findMessageById(message.replies, id);
        if (found) return found;
      }
      return null;
    },
    []
  );

  const fetchAvailableModels = useCallback(async () => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch available models from OpenRouter:", errorText);
        throw new Error("Failed to fetch available models from OpenRouter");
      }

      const data = await response.json();
      console.log("Received data from OpenRouter:", data);

      if (!data.data) {
        console.error('Response data does not contain "data" key.');
        throw new Error("Invalid response format from OpenRouter");
      }

      const modelData = data.data.map((model: any) => {
        const maxOutput = model.top_provider?.max_completion_tokens ?? model.context_length ?? 9999;
        return {
          id: model.id,
          name: model.name,
          baseModel: model.id,
          systemPrompt: "",
          parameters: {
            top_p: 1,
            temperature: 0.7,
            frequency_penalty: 0,
            presence_penalty: 0,
            top_k: 0,
            max_tokens: maxOutput, // Set initial max_tokens to maxOutput
            max_output: maxOutput, // Include max_output in the parameters
          },
        };
      });
      setAvailableModels(modelData);
      return modelData;
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }, []);

  const fetchModelParameters = async (modelId: string) => {
    console.log(`Fetching parameters for model ID: ${modelId}`);
    try {
      const response = await fetch(`/api/model-parameters?modelId=${encodeURIComponent(modelId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch model parameters: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      // Find the corresponding model in availableModels to get the max_output
      const selectedModel = availableModels.find(model => model.id === modelId);
      if (selectedModel && selectedModel.parameters?.max_output) {
        data.max_output = selectedModel.parameters.max_output;
      }

      return data;
    } catch (error) {
      console.error("Error fetching model parameters:", error);
      throw error;
    }
  };

  const handleModelChange = useCallback(
    (field: keyof Model, value: string | number | Partial<ModelParameters>) => {
      if (editingModel) {
        setEditingModel((prevModel) => {
          if (!prevModel) return prevModel;
          if (field === "parameters") {
            return { ...prevModel, parameters: { ...prevModel.parameters, ...value as Partial<ModelParameters> } };
          }
          if (field === "baseModel") {
            return { ...prevModel, baseModel: value as string };
          }
          return { ...prevModel, [field]: value };
        });
      }
    },
    [editingModel, availableModels]
  );

  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch(
          apiBaseUrl ? `${apiBaseUrl}/api/load_models` : "/api/load_models",
          {
            method: "GET",
          }
        );
        if (response.ok) {
          const data = await response.json();
          console.log("Loaded models:", data.models);
          let loadedModels = data.models || [];

          // If no models are loaded, add the default model
          if (loadedModels.length === 0) {
            loadedModels = [DEFAULT_MODEL];
          }

          setModels(loadedModels);
          setSelectedModel(loadedModels[0].id);
          setModelsLoaded(true);
        } else {
          console.error("Failed to load models from backend.");
          // Add default model if loading fails
          setModels([DEFAULT_MODEL]);
          setSelectedModel(DEFAULT_MODEL.id);
          setModelsLoaded(true);
        }
      } catch (error) {
        console.error("Error loading models:", error);
        // Add default model if an error occurs
        setModels([DEFAULT_MODEL]);
        setSelectedModel(DEFAULT_MODEL.id);
        setModelsLoaded(true);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    const saveModels = async () => {
      try {
        await fetch(
          apiBaseUrl ? `${apiBaseUrl}/api/save_models` : "/api/save_models",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ models }),
          }
        );
      } catch (error) {
        console.error("保存模型数据失败：", error);
      }
    };

    if (modelsLoaded && models.length > 0) {
      saveModels();
    }
  }, [models, modelsLoaded]);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  // Update message content
  const updateMessageContent = useCallback(
    (threadId: string, messageId: string, content: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const updateContent = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === messageId) {
                return { ...message, content };
              }
              return { ...message, replies: updateContent(message.replies) };
            });
          };
          return { ...thread, messages: updateContent(thread.messages) };
        })
      );
    },
    []
  );

  const collapseDeepChildren = useCallback((msg: Message, selectedDepth: number, currentDepth: number, isSelectedBranch: boolean): Message => {
    const maxDepth = window.innerWidth >= 1024 ? 6 :
      window.innerWidth >= 768 ? 5 :
        window.innerWidth >= 480 ? 4 : 3;

    const isCollapsed = isSelectedBranch
      ? currentDepth - selectedDepth >= maxDepth
      : currentDepth >= maxDepth;

    return {
      ...msg,
      isCollapsed: isCollapsed,
      replies: msg.replies.map(reply => collapseDeepChildren(reply, selectedDepth, currentDepth + 1, isSelectedBranch))
    };
  }, []);

  useEffect(() => {
    if (selectedMessage && currentThread) {
      setThreads(prevThreads => prevThreads.map(thread => {
        if (thread.id === currentThread) {
          const findSelectedMessageBranch = (messages: Message[], depth: number = 0): [number, Message[]] => {
            for (const msg of messages) {
              if (msg.id === selectedMessage) return [depth, [msg]];
              const [foundDepth, branch] = findSelectedMessageBranch(msg.replies, depth + 1);
              if (foundDepth !== -1) return [foundDepth, [msg, ...branch]];
            }
            return [-1, []];
          };

          const [selectedDepth, selectedBranch] = findSelectedMessageBranch(thread.messages);

          return {
            ...thread,
            messages: thread.messages.map(msg => {
              const isSelectedBranch = selectedBranch.includes(msg);
              return collapseDeepChildren(msg, selectedDepth, 0, isSelectedBranch);
            })
          };
        }
        return thread;
      }));
    }
  }, [selectedMessage, currentThread, collapseDeepChildren]);

  // Generate AI reply
  const generateAIReply = useCallback(
    async (threadId: string, messageId: string, count: number = 1) => {
      const thread = threads.find((t: { id: string }) => t.id === threadId);
      if (!thread) return;

      const message = findMessageById(thread.messages, messageId);
      if (!message) return;

      setIsGenerating(true);
      try {
        const model =
          models.find((m: { id: any }) => m.id === selectedModel) || models[0];
        for (let i = 0; i < count; i++) {
          const reader = await generateAIResponse(
            message.content,
            message.publisher,
            model,
            threads,
            threadId,
            messageId
          );

          const newMessageId = Date.now().toString();
          addMessage(threadId, messageId, "", "ai", newMessageId);
          setSelectedMessage(newMessageId);

          let fullResponse = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            // console.log(chunk);
            const lines = chunk.split("data: ");
            for (const line of lines) {
              const data = line.replace(/\n\n$/, "");
              if (data === "[DONE]") {
                break;
              }
              fullResponse += data;
              updateMessageContent(threadId, newMessageId, fullResponse);
            }
          }
        }
      } catch (error) {
        console.error("Failed to generate AI response:", error);
      } finally {
        setIsGenerating(false);
      }
    },
    [
      threads,
      models,
      selectedModel,
      addMessage,
      setSelectedMessage,
      findMessageById,
      updateMessageContent,
    ]
  );

  // Render a single message
  function renderMessage(
    message: Message,
    threadId: string,
    depth = 0,
    parentId: string | null = null
  ) {
    // Message selection and hierarchy
    const isSelected = selectedMessage === message.id;
    const isParentOfSelected = selectedMessage !== null &&
      findMessageById(message.replies, selectedMessage) !== null;
    const isSelectedOrParent = isSelected || isParentOfSelected || parentId === message.id;

    // Indentation
    const indent = depth === 0 ? 0 : (isSelectedOrParent ? 0 : MESSAGE_INDENT);

    // Helper functions
    const getTotalReplies = (msg: Message): number => {
      return msg.replies.reduce((total, reply) => total + 1 + getTotalReplies(reply), 0);
    };

    const getSiblings = (parent: Message | null): Message[] => {
      return parent ? parent.replies : currentThreadData?.messages || [];
    };

    const handleCopy = (codeString: string, codeBlockId: string) => {
      navigator.clipboard.writeText(codeString);
      setCopiedStates(prev => ({ ...prev, [codeBlockId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeBlockId]: false }));
      }, 2000);
    };

    // Thread and message data
    const currentThreadData = threads.find((t) => t.id === currentThread);
    if (!currentThreadData) return null;

    const [currentMessage, parentMessages] = findMessageAndParents(
      currentThreadData.messages,
      message.id
    );
    if (!currentMessage) return null;

    const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
    const siblings = getSiblings(parentMessage);

    // Additional data
    const totalReplies = getTotalReplies(message);
    const currentIndex = siblings.findIndex((m) => m.id === currentMessage.id);

    return (
      <div
        key={message.id}
        className="mt-2"
        style={{ marginLeft: `${indent}px` }}
        id={`message-${message.id}`}
      >
        <div
          className={`flex 
        items-start 
        space-x-1 
        p-1 
        rounded 
        hover:bg-secondary/50 
        ${isSelectedOrParent ? "bg-muted" : "text-muted-foreground"}
      `}
          onClick={() => {
            setSelectedMessage(message.id);
            if (message.isCollapsed) {
              toggleCollapse(threadId, message.id);
            }
          }}
        >
          <div className="flex-grow p-0 overflow-hidden">
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 rounded-sm hover:bg-secondary bg-background border border-border"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(threadId, message.id);
                    }}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform duration-200 ${message.isCollapsed ? 'rotate-0' : 'rotate-90'
                        }`}
                    />
                  </Button>
                  <span
                    className={`font-bold ${message.publisher === "ai"
                      ? "text-blue-600"
                      : "text-green-600"
                      }`}
                  >
                    {parentId === null ||
                      message.publisher !==
                      findMessageById(
                        threads.find((t) => t.id === currentThread)?.messages ||
                        [],
                        parentId
                      )?.publisher
                      ? message.publisher === "ai"
                        ? message.modelName || "AI"
                        : "User"
                      : null}
                  </span>
                </div>
                {/* New navigation controls */}
                <div
                  className={`flex space-x-1 ${isSelectedOrParent || isSelected
                    ? "opacity-100"
                    : "opacity-0 hover:opacity-100"
                    } transition-opacity duration-200`}
                >
                  {parentMessage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(parentMessage.id);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {currentMessage.replies.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(currentMessage.replies[0].id);
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {siblings[currentIndex - 1] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(siblings[currentIndex - 1].id);
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                  {siblings[currentIndex + 1] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(siblings[currentIndex + 1].id);
                      }}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {editingMessage === message.id ? (
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="min-font-size font-serif flex-grow w-auto m-1 p-0"
                  style={{
                    minHeight: Math.min(
                      Math.max(
                        20,
                        editingContent.split("\n").length * (
                          window.innerWidth < 480 ? 50 :
                            window.innerWidth < 640 ? 40 :
                              window.innerWidth < 1024 ? 30 :
                                20
                        ),
                        editingContent.length * (
                          window.innerWidth < 480 ? 0.6 :
                            window.innerWidth < 640 ? 0.5 :
                              window.innerWidth < 1024 ? 0.35 :
                                0.25
                        )
                      ),
                      window.innerHeight * 0.5
                    ),
                    maxHeight: "50vh",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      confirmEditingMessage(threadId, message.id);
                    } else if (e.key === "Escape") {
                      cancelEditingMessage();
                    }
                  }}
                />
              ) : (
                <div
                  className="whitespace-normal break-words markdown-content font-serif overflow-hidden pt-0.5 px-1 "
                  onDoubleClick={() => {
                    cancelEditingMessage();
                    startEditingMessage(message);
                  }}
                >
                  {message.isCollapsed ? (
                    `
                    ${message.content.split("\n")[0].slice(0, 50)}
                    ${message.content.length > 50 ? "..." : ""}
                    ${totalReplies > 0
                      ? ` (${totalReplies} ${totalReplies === 1 ? "reply" : "replies"
                      })`
                      : ""
                    }`
                  ) : (
                    <div className="markdown-content">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          code({
                            node,
                            inline,
                            className,
                            children,
                            ...props
                          }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeString = String(children).replace(/\n$/, "");
                            const codeBlockId = `code-${message.id}-${match ? match[1] : 'unknown'}`;
                            return !inline && match ? (
                              <div className="relative">
                                <div className="absolute -top-6 w-full text-muted-foreground flex justify-between items-center p-0 text-xs">
                                  <span>{match[1]}</span>
                                  <Button
                                    className="w-6 h-6 p-0"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(codeString, codeBlockId)}
                                  >
                                    {copiedStates[codeBlockId] ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <SyntaxHighlighter
                                  className="text-xs"
                                  PreTag={"pre"}
                                  style={gruvboxDark}
                                  language={match[1]}
                                  // showLineNumbers
                                  wrapLines
                                  {...props}
                                >
                                  {codeString}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {message.content}
                      </Markdown>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedMessage === message.id && (
              <div className="space-x-1 mt-1 flex flex-wrap items-center select-none">
                {editingMessage === message.id ? (
                  <>
                    <Button
                      className="hover:bg-background space-x-2"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        confirmEditingMessage(threadId, message.id)
                      }
                    >
                      <Check className="h-4 w-4" />
                      <span className="hidden md:inline ml-auto">
                        <MenubarShortcut>⌘ ↩</MenubarShortcut>
                      </span>
                    </Button>
                    <Button
                      className="hover:bg-background space-x-2"
                      size="sm"
                      variant="ghost"
                      onClick={cancelEditingMessage}
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden md:inline ml-auto">
                        <MenubarShortcut>Esc</MenubarShortcut>
                      </span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="h-10 hover:bg-background"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        cancelEditingMessage();
                        setSelectedMessage(null);
                        addEmptyReply(threadId, message.id);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden md:inline ml-2">Reply</span>
                    </Button>
                    <Menubar className="p-0 border-none bg-transparent">
                      <MenubarMenu>
                        <MenubarTrigger
                          className={cn(
                            "h-10 rounded-lg hover:bg-background",
                            isGenerating &&
                            "animate-pulse bg-blue-200 dark:bg-blue-900"
                          )}
                        >
                          <Sparkle className="h-4 w-4" />
                          <span className="hidden md:inline ml-2">
                            Generate
                          </span>
                        </MenubarTrigger>
                        <MenubarContent>
                          <MenubarItem
                            onClick={() =>
                              generateAIReply(threadId, message.id, 1)
                            }
                          >
                            Once
                            <MenubarShortcut className="ml-auto">
                              ⎇ G
                            </MenubarShortcut>
                          </MenubarItem>
                          <MenubarItem
                            onClick={() =>
                              generateAIReply(threadId, message.id, 3)
                            }
                          >
                            Thrice
                          </MenubarItem>
                          <MenubarItem
                            onClick={() => {
                              const times = prompt(
                                "How many times do you want to generate?",
                                "5"
                              );
                              const numTimes = parseInt(times || "0", 10);
                              if (
                                !isNaN(numTimes) &&
                                numTimes > 0 &&
                                numTimes <= 10
                              ) {
                                generateAIReply(threadId, message.id, numTimes);
                              } else if (numTimes > 10) {
                                generateAIReply(threadId, message.id, 10);
                              }
                            }}
                          >
                            Custom
                          </MenubarItem>
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>
                    <Button
                      className="h-10 hover:bg-background"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        cancelEditingMessage();
                        startEditingMessage(message);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      <span className="hidden md:inline ml-2">Edit</span>
                    </Button>
                    <Menubar className="p-0 border-none bg-transparent">
                      <MenubarMenu>
                        <MenubarTrigger className="h-10 hover:bg-background">
                          <Trash className="h-4 w-4" />
                          <span className="hidden md:inline ml-2">Delete</span>
                        </MenubarTrigger>
                        <MenubarContent>
                          <MenubarItem
                            onClick={() =>
                              deleteMessage(threadId, message.id, false)
                            }
                          >
                            Keep Children
                            <span className="hidden md:inline ml-auto">
                              <MenubarShortcut>⌫</MenubarShortcut>
                            </span>
                          </MenubarItem>
                          <MenubarItem
                            onClick={() =>
                              deleteMessage(threadId, message.id, true)
                            }
                          >
                            With Children
                            <span className="hidden md:inline ml-auto">
                              <MenubarShortcut>⇧ ⌫</MenubarShortcut>
                            </span>
                          </MenubarItem>
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {!message.isCollapsed &&
          message.replies.map((reply) =>
            renderMessage(reply, threadId, depth + 1, message.id)
          )}
      </div>
    );
  }

  const saveModelChanges = useCallback(() => {
    if (editingModel) {
      setModels((prev: Model[]) =>
        prev.map((model: Model) =>
          model.id === editingModel.id ? { ...model, ...editingModel } : model
        )
      );
      setEditingModel(null);
    }
  }, [editingModel]);

  const deleteModel = useCallback(
    (id: string) => {
      setModels((prev: any[]) =>
        prev.filter((model: { id: string }) => model.id !== id)
      );
      // If the deleted model was selected, switch to the first available model
      if (selectedModel === id) {
        setSelectedModel(models[0].id);
      }
    },
    [models, selectedModel]
  );

  const addNewModel = useCallback(() => {
    const newModel: Model = {
      id: Date.now().toString(),
      name: "New Model",
      baseModel: "none",
      systemPrompt: "You are a helpful assistant.",
      parameters: {
        temperature: 1,
        top_p: 1,
        max_tokens: 2000,
      },
    };
    setModels((prev: any) => [...prev, newModel]);
    setEditingModel(newModel);
  }, []);

  const toggleThreadPin = useCallback((threadId: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, isPinned: !thread.isPinned }
          : thread
      )
    );
  }, []);

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev: Thread[]) => {
        const updatedThreads = prev.filter((thread) => thread.id !== threadId);
        if (currentThread === threadId) {
          setCurrentThread(
            updatedThreads.length > 0 ? updatedThreads[0].id : null
          );
        }
        return updatedThreads;
      });

      const deleteThreadFromBackend = async () => {
        try {
          const response = await fetch(
            apiBaseUrl
              ? `${apiBaseUrl}/api/delete_thread/${threadId}`
              : `/api/delete_thread/${threadId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            }
          );
          if (!response.ok) {
            throw new Error(`Failed to delete thread ${threadId}`);
          }
          console.log(`Thread ${threadId} has been successfully deleted.`);
        } catch (error) {
          console.error(`Failed to delete thread ${threadId} data:`, error);
        }
      };

      deleteThreadFromBackend();
    },
    [currentThread]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if any input element is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // Special cases for thread title editing
      if (editingThreadTitle && isInputFocused) {
        if (event.key === 'Enter') {
          event.preventDefault();
          setEditingThreadTitle(null);
        }
        else if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditThreadTitle();
        }
        return
      }

      // Special cases for message editing
      if (editingMessage && isInputFocused) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (currentThread) {
            confirmEditingMessage(currentThread, editingMessage);
          }
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditingMessage();
        }
        return;
      }

      // Special cases for model editing
      if (editingModel && isInputFocused) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          saveModelChanges();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setEditingModel(null);
        }
        return;
      }

      // If any other input is focused, don't handle hotkeys
      if (isInputFocused) {
        return;
      }

      // Only handle navigation and action hotkeys if no input is focused
      if (!isInputFocused) {
        if (!selectedMessage || !currentThread) return;

        const currentThreadData = threads.find((t) => t.id === currentThread);
        if (!currentThreadData) return;

        const [currentMessage, parentMessages] = findMessageAndParents(
          currentThreadData.messages,
          selectedMessage
        );
        const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
        if (!currentMessage) return;

        // Helper function to get sibling messages
        const getSiblings = (parent: Message | null): Message[] => {
          if (!parent) return currentThreadData.messages;
          return parent.replies;
        };

        switch (event.key) {
          case "ArrowLeft":
            // Select parent message
            if (parentMessage) {
              setSelectedMessage(parentMessage.id);
            }
            break;
          case "ArrowRight":
            // Select first child message
            if (currentMessage.replies.length > 0) {
              setSelectedMessage(currentMessage.replies[0].id);
            }
            break;
          case "ArrowUp":
            // Select previous sibling
            const siblings = getSiblings(parentMessage);
            const currentIndex = siblings.findIndex(
              (m) => m.id === currentMessage.id
            );
            if (currentIndex > 0) {
              setSelectedMessage(siblings[currentIndex - 1].id);
            }
            break;
          case "ArrowDown":
            // Select next sibling
            const nextSiblings = getSiblings(parentMessage);
            const nextIndex = nextSiblings.findIndex(
              (m) => m.id === currentMessage.id
            );
            if (nextIndex < nextSiblings.length - 1) {
              setSelectedMessage(nextSiblings[nextIndex + 1].id);
            }
            break;
          case "r":
            // R for replying to a message
            event.preventDefault();
            if (currentThread) {
              addEmptyReply(currentThread, selectedMessage);
            }
            break;
          case "g":
            // G for generating AI reply
            event.preventDefault();
            if (currentThread) {
              generateAIReply(currentThread, selectedMessage);
            }
            break;
          case "e":
            // E for editing a message
            if (!editingMessage) {
              event.preventDefault();
              const message = findMessageById(
                currentThreadData.messages,
                selectedMessage
              );
              if (message) {
                startEditingMessage(message);
              }
            }
            break;
          case "Delete":
          case "Backspace":
            // Delete or Backspace for deleting a message
            if (event.shiftKey) {
              // Shift+Delete/Backspace to delete the message and its children
              deleteMessage(currentThread, selectedMessage, true);
            } else {
              // Regular Delete/Backspace to delete only the message
              deleteMessage(currentThread, selectedMessage, false);
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedMessage,
    editingMessage,
    currentThread,
    editingThreadTitle,
    threads,
    editingModel,
    generateAIReply,
    addEmptyReply,
    startEditingMessage,
    deleteMessage,
    findMessageById,
    confirmEditingMessage,
    cancelEditingMessage,
    saveModelChanges,
  ]);

  // Sort threads with pinned threads at the top
  const sortedThreads = threads.sort(
    (a: { isPinned: any }, b: { isPinned: any }) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    }
  );

  // Render the list of threads
  function renderThreadsList() {
    return (
      <div className="flex flex-col relative h-[calc(97vh)]">
        <div
          className="top-bar bg-gradient-to-b from-background/100 to-background/00 select-none"
          style={{
            mask: "linear-gradient(black, black, transparent)",
            backdropFilter: "blur(1px)",
          }}
        >
          <h2 className="text-2xl font-serif font-bold pl-2">Threads</h2>
          <Button
            className="bg-background hover:bg-secondary text-primary border border-border"
            size="default"
            onClick={addThread}
          >
            <ListPlus className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">New Thread</span>
          </Button>
        </div>
        <ScrollArea
          className="flex-auto"
          onClick={() => {
            setCurrentThread(null);
            if (editingThreadTitle) {
              cancelEditThreadTitle();
            }
          }}
        >
          <div className="my-2">
            {sortedThreads.map((thread) => (
              <div
                key={thread.id}
                className={`font-serif px-1 cursor-pointer rounded mb-2 ${currentThread === thread.id
                  ? "bg-secondary"
                  : "hover:bg-secondary text-muted-foreground"
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentThread(thread.id);
                }}
              >
                <div className="flex-grow">
                  {editingThreadTitle === thread.id ? (
                    <div className="flex items-center justify-between">
                      <Input
                        ref={threadTitleInputRef}
                        value={thread.title}
                        onChange={(e) =>
                          setThreads((prev: Thread[]) =>
                            prev.map((t) =>
                              t.id === thread.id ? { ...t, title: e.target.value } : t
                            )
                          )
                        }
                        className="min-font-size flex-grow h-8 p-1 my-1"
                        onClick={(e) => e.stopPropagation()}
                        maxLength={64}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmEditThreadTitle(thread.id, thread.title);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEditThreadTitle();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmEditThreadTitle(thread.id, thread.title);
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditThreadTitle();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditingThreadTitle(thread.id, thread.title);
                      }}
                    >
                      <span className="pl-1 flex-grow">{thread.title}</span>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleThreadPin(thread.id);
                          }}
                        >
                          {thread.isPinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteThread(thread.id);
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Render messages for the current thread
  function renderMessages() {
    const currentThreadData = threads.find((t) => t.id === currentThread);
    return currentThread ? (
      <div
        className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar`}
      >
        <div
          className="top-bar bg-gradient-to-b from-background/100 to-background/00"
          style={{
            mask: "linear-gradient(black, black, transparent)",
            backdropFilter: "blur(1px)",
          }}
        >
          <h1 className="text-2xl font-serif font-bold pl-2 overflow-hidden">
            <span className="block truncate text-2xl sm:text-sm md:text-base lg:text-xl xl:text-2xl">
              {currentThreadData?.title}
            </span>
          </h1>
          {currentThread && (
            <Button
              className="bg-background hover:bg-secondary text-primary border border-border select-none"
              size="default"
              onClick={(e) => {
                e.stopPropagation();
                cancelEditingMessage();
                addEmptyReply(currentThread, null);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="ml-2 hidden md:inline">New Message</span>
            </Button>
          )}
        </div>
        <ScrollArea className="flex-grow">
          <div className="mb-4">
            {currentThreadData?.messages.map((message: any) =>
              renderMessage(message, currentThread)
            )}
          </div>
        </ScrollArea>
      </div>
    ) : (
      <div className="flex items-center justify-center h-full select-none">
        <div className="hidden sm:block">
          <p className="text-sm text-muted-foreground whitespace-pre">
            <span>  ←/→ Arrow keys        ┃ Navigate parent/children</span><br />
            <span>  ↑/↓ Arrow keys        ┃ Navigate on same level</span><br />
            <span>  R                     ┃ Reply</span><br />
            <span>  G                     ┃ Generate AI reply</span><br />
            <span>  E/Double-click        ┃ Edit message</span><br />
            <span>  Enter                 ┃ Confirm edit</span><br />
            <span>  Escape                ┃ Cancel edit</span><br />
            <span>  Delete                ┃ Delete message</span><br />
            <span>  Shift+Delete          ┃ Delete with children</span>
          </p>
          <div className="mt-4 text-center text-sm text-muted-foreground font-serif">
            <span>Select a thread to view messages.</span>
            <br />
            <a
              href="https://github.com/yijia-z/aide"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
            <span className="mx-2">|</span>
            <a href="mailto:z@zy-j.com" className="hover:underline">
              Contact
            </a>
          </div>
        </div>
        <div className="sm:hidden fixed bottom-20 left-0 right-0 p-4 text-center text-sm text-muted-foreground bg-background font-serif">
          <span>Select a thread to view messages.</span>
          <br />
          <a
            href="https://github.com/yijia-z/aide"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
          <span className="mx-2">|</span>
          <a href="mailto:z@zy-j.com" className="hover:underline">
            Contact
          </a>
        </div>
      </div>
    );
  }

  // Render model configuration
  function renderModelConfig() {
    return (
      <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
        <div
          className="top-bar bg-gradient-to-b from-background/100 to-background/00"
          style={{
            mask: "linear-gradient(black, black, transparent)",
            backdropFilter: "blur(1px)",
          }}
        >
          <Select value={selectedModel ?? undefined} onValueChange={setSelectedModel}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-background hover:bg-secondary text-primary border border-border"
            size="default"
            onClick={addNewModel}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">New Model</span>
          </Button>
        </div>
        <ScrollArea className="flex-grow">
          <div className="flex-grow overflow-y-auto my-2">
            {models.map((model) => (
              <div key={model.id} className="p-2 border rounded mb-2">
                <div onDoubleClick={() => setEditingModel(model)}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">{model.name}</h3>
                  </div>
                  {editingModel?.id === model.id ? (
                    <div className="space-y-2 text-muted-foreground">
                      <Label>Name</Label>
                      <Input
                        className="min-font-size text-foreground"
                        value={editingModel?.name}
                        onChange={(e) =>
                          handleModelChange("name", e.target.value)
                        }
                      />
                      <Label>Base Model</Label>
                      <SelectBaseModel
                        value={editingModel.baseModel}
                        onValueChange={(value, parameters) => {
                          handleModelChange("baseModel", value);
                          handleModelChange("parameters", parameters as Partial<ModelParameters>);
                        }}
                        fetchAvailableModels={fetchAvailableModels}
                        fetchModelParameters={fetchModelParameters}
                        existingParameters={editingModel.parameters}
                      />
                      <Label>System Prompt</Label>
                      <Textarea
                        className="min-font-size text-foreground"
                        value={editingModel?.systemPrompt}
                        onChange={(e) =>
                          handleModelChange("systemPrompt", e.target.value)
                        }
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="space-x-2 text-foreground">
                          <Button size="sm" variant="outline" onClick={saveModelChanges}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingModel(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteModel(model.id)}
                          disabled={models.length === 1}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm cursor-pointer">
                      <p><span className="text-muted-foreground">Base Model:</span> {model.baseModel.split('/').pop()}</p>
                      <p><span className="text-muted-foreground">Temperature:</span> {model.parameters.temperature}</p>
                      <p><span className="text-muted-foreground">Max Tokens:</span> {model.parameters.max_tokens}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row p-2 overflow-hidden ">
      <div className="sm:hidden bg-transparent">
        {/* Mobile layout with tabs for threads, messages, and models */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "threads" | "messages" | "models")
          }
          className="w-full flex flex-col"
        >
          <TabsContent
            value="threads"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderThreadsList()}
          </TabsContent>
          <TabsContent
            value="messages"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderMessages()}
          </TabsContent>
          <TabsContent
            value="models"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderModelConfig()}
          </TabsContent>
          <TabsList
            className="grid 
              bg-background/50 
              backdrop-blur-[3px] 
              w-full 
              fixed 
              bottom-0 
              left-0 
              right-0 
              pb-14 
              grid-cols-3
              select-none"
          >
            <TabsTrigger
              value="threads"
              className="data-[state=active]:bg-secondary"
            >
              Threads
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-secondary"
            >
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="data-[state=active]:bg-secondary"
            >
              Models
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div
        className="hidden sm:block w-full h-full"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Desktop layout with resizable panels */}
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={31} minSize={26} maxSize={50}>
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "threads" | "models")
              }
              className="w-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-2 select-none">
                <TabsTrigger value="threads">Threads</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
              </TabsList>
              <TabsContent
                value="threads"
                className="flex-grow overflow-y-clip"
              >
                {renderThreadsList()}
              </TabsContent>
              <TabsContent value="models" className="flex-grow overflow-y-clip">
                {renderModelConfig()}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-2" />
          <ResizablePanel defaultSize={69}>
            <div className="h-full overflow-y-auto">{renderMessages()}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
