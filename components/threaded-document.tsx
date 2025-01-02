"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import debounce from "lodash.debounce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { storage } from "./store";
// import { createOfflineDetector } from '@/components/utils/offline-detector';
import ThreadList from "@/components/thread/thread-list";
import ModelConfig from "./model/model-config";
import RenderMessages from "@/components/message/render-all-messages";
import { ToolManager } from "./tool/tool-manager";
import { generateAIResponse } from "@/components/utils/api";
import { Thread, Message, Model, ModelParameters, Tool, ContentPart } from "./types";
import { useModels } from "./hooks/use-models";
import { useThreads } from "./hooks/use-threads";
import { useMessages } from "./hooks/use-messages";
import { useUser, useClerk } from "@clerk/nextjs";
import { SettingsPanel } from "./settings/settings-panel"
import { useTools } from "./hooks/use-tools";
import { useUserProfile } from "./hooks/use-userprofile";
import { AlignJustify, MessageSquare, Sparkle, Settings, Package } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
const DEFAULT_MODEL: Model = {
  id: "default",
  name: "Default Model",
  baseModel: "meta-llama/llama-3.2-3b-instruct:free",
  systemPrompt: "You are a helpful assistant.",
  parameters: {
    temperature: 1.3,
    top_p: 1,
    max_tokens: 1000,
  },
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ThreadedDocument() {
  const { isSignedIn } = useUser();
  const { username } = useUserProfile();
  // const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models" | "tools" | "settings">(
    (storage.get('activeTab') || "threads") as "threads" | "messages" | "models" | "tools" | "settings"
    // !session ? "settings" : "threads"
  )

  // Thread-related states
  const {
    threads,
    setThreads,
    currentThread,
    setCurrentThread,
    editingThreadTitle,
    setEditingThreadTitle,
    originalThreadTitle,
    setOriginalThreadTitle,
    threadToDelete,
    setThreadToDelete,
    newThreadId,
    setNewThreadId
  } = useThreads();
  const threadTitleInputRef = useRef<HTMLInputElement>(null);

  // Message-related states
  const {
    selectedMessages,
    setSelectedMessages,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editingContent,
    setEditingContent,
    clipboardMessage,
    setClipboardMessage,
    glowingMessageIds,
    addGlowingMessage,
    removeGlowingMessage,
    clearGlowingMessages,
    lastGenerateCount,
    setLastGenerateCount,
  } = useMessages();
  const replyBoxRef = useRef<HTMLDivElement>(null);

  // Model-related states
  const {
    modelsLoaded,
    setModelsLoaded,
    availableModels,
    setAvailableModels,
    models,
    setModels,
    selectedModels,
    setSelectedModels,
    editingModel,
    setEditingModel,
  } = useModels();

  // Connection and generation states
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState<{ [key: string]: boolean }>({});
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  // const [scrollPosition, setScrollPosition] = useState<number>(0);

  // Tool-related states
  const {
    tools,
    setTools,
    toolsLoading,
    setToolsLoading,
    toolsError,
    setToolsError,
    availableTools,
    setAvailableTools,
  } = useTools();

  // Load tools
  const loadTools = useCallback(async () => {
    if (apiBaseUrl) {
      setToolsLoading(true);
      try {
        const response = await fetch(`/api/tools`);
        const data = await response.json();
        // console.log("Loaded tools:", data);
        setTools(data.tools || []);
      } catch (error) {
        console.error("Error loading tools:", error);
        setToolsError("Failed to load tools.");
      } finally {
        setToolsLoading(false);
      }
    }
  }, [setToolsLoading, setTools, setToolsError]);

  useEffect(() => {
    const savedTab = storage.get('activeTab');
    if (savedTab) {
      setActiveTab(savedTab as "threads" | "messages" | "models" | "tools" | "settings");
    }
    loadTools();
  }, [loadTools]);

  useEffect(() => {
    storage.set('activeTab', activeTab);
  }, [activeTab]);


  useEffect(() => {
    if (!currentThread) {
      console.log("[ThreadedDocument] currentThread = null, 跳过 fetch");
      return;
    }
  
    const fetchSingleThread = async () => {
      try {
        // 1) 获取 thread 基本信息
        const resThread = await fetch(`/api/threads/${currentThread}`);
        if (!resThread.ok) {
          throw new Error("Failed to fetch thread info");
        }
        const dataThread = await resThread.json();
        // dataThread.thread = { id, title, ... } (不再包含 messages)
  
        // 2) 获取 messages 列表
        const resMessages = await fetch(`/api/messages?threadId=${currentThread}`);
        if (!resMessages.ok) {
          throw new Error("Failed to fetch messages for thread");
        }
        const dataMessages = await resMessages.json();
        // dataMessages.messages = [ { id, content, parentId, ... }, ... ]
  
        // 3) 合并到一个对象上
        const fetchedThread = {
          ...dataThread.thread,          // 例如 { id, title, isPinned, ... }
          messages: dataMessages.messages ?? [] // 自己把消息列表挂到 thread.messages
        };
  
        // 4) 更新前端 threads 状态
        setThreads((prev) => {
          // 如果 threads 里还没有 currentThread，就 push；否则替换
          const idx = prev.findIndex((t) => t.id === currentThread);
          if (idx === -1) {
            return [...prev, fetchedThread];
          } else {
            const newThreads = [...prev];
            newThreads[idx] = fetchedThread;
            return newThreads;
          }
        });
      } catch (error) {
        console.error("[fetchSingleThread] error:", error);
      }
    };
  
    fetchSingleThread();
  }, [currentThread, setThreads]);
  

  /*   useEffect(() => {
      const offlineDetector = createOfflineDetector();
      const removeListener = offlineDetector.addListener((offline) => {
        setIsOffline(offline);
      });
  
      return () => {
        removeListener();
      };
    }, []);
   */
  // Helper methods
  const getModelDetails = (modelId: string | undefined) => {
    if (!modelId) return null;
    const model = models.find((m) => m.id === modelId);
    if (!model) return null;
    return {
      name: model.name,
      baseModel: model.baseModel.split("/").pop(),
      temperature: model.parameters.temperature,
      maxTokens: model.parameters.max_tokens,
      systemPrompt: model.systemPrompt,
      tools: model.parameters.tools
    };
  };

  // Confirm editing a message
  const confirmEditingMessage = useCallback(
    (threadId: string, messageId: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const editMessage = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === messageId) {
                return { ...message, content: editingContent };
              }
              return { ...message, replies: editMessage(message.replies) };
            });
          };
          return { ...thread, messages: editMessage(thread.messages) };
        })
      );
      setEditingMessage(null);
      setEditingContent("");
    },
    [editingContent, setEditingContent, setEditingMessage, setThreads]
  );

  // Fetch available models from the API or cache
  const fetchAvailableModels = useCallback(async () => {
    try {
      const cachedModels = storage.get("availableModels");
      const lastFetchTime = storage.get("lastFetchTime");
      const currentTime = Date.now();

      // If cached models exist and were fetched less than an hour ago, use them
      if (
        cachedModels &&
        lastFetchTime &&
        currentTime - parseInt(lastFetchTime) < 3600000
      ) {
        const modelData = cachedModels;
        setAvailableModels(modelData);
        return modelData;
      }

      // Fetch from API if no valid cache is found
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Failed to fetch available models from OpenRouter:",
          errorText
        );
        throw new Error("Failed to fetch available models from OpenRouter");
      }

      const data = await response.json();

      if (!data.data) {
        console.error('Response data does not contain "data" key.');
        throw new Error("Invalid response format from OpenRouter");
      }

      const modelData = data.data.map((model: any) => {
        const maxOutput =
          model.top_provider?.max_completion_tokens ??
          model.context_length ??
          9999;
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

      // Cache the fetched models and update the fetch time
      storage.set("availableModels", modelData);
      storage.set("lastFetchTime", currentTime.toString());

      setAvailableModels(modelData);
      return modelData;
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }, [setAvailableModels]);

  // Save threads to storage and backend
 const saveThreads = useCallback(async (threadsToSave: Thread[]) => {
    try {
      // Always save to local storage/IndexedDB
      await storage.setLarge("threads", threadsToSave);

      // Only try to save to backend if online
      if (apiBaseUrl) {
        const savePromises = threadsToSave.map((thread: Thread) =>
          fetch(`/api/threads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId: thread.id, thread }),
          })
        );
        await Promise.all(savePromises);
      }
    } catch (error) {
      console.error("Failed to save threads:", error);
    }
  }, [apiBaseUrl]);

  // Debounce saveThreads to avoid frequent saves
  const debouncedSaveThreads = useMemo(
    () => debounce(saveThreads, 2000),
    [saveThreads]
  ); 
 
  // Add new thread
  const addThread = useCallback(async () => {
    console.log("[addThread] start create thread");
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });
      console.log("[addThread] after fetch, res.ok =", res.ok);
      if (!res.ok) {
        throw new Error("Failed to create thread");
      }
      const data = await res.json();
      console.log("[addThread] after res.json(), data =", data);
  
      const newThread: Thread = data.thread;
      setThreads((prev) => [...prev, newThread]);
      setCurrentThread(newThread.id);
      setEditingThreadTitle(newThread.id);
      setOriginalThreadTitle(newThread.title || "");
      setNewThreadId(newThread.id);
      console.log("[addThread] success, newThreadId =", newThread.id);
    } catch (error) {
      console.error("[addThread] error:", error);
    }
  }, [  
    setThreads,
    setCurrentThread,
    setEditingThreadTitle,
    setOriginalThreadTitle,
    setNewThreadId
  ]
  );
  
  // Add message to a thread
  const addMessage = useCallback(
    (
      threadId: string,
      parentId: string | null,
      content: string | ContentPart[],
      publisher: "user" | "ai",
      newMessageId?: string,
      modelDetails?: Model
    ) => {
      const realId = uuidv4();
      // 1) 先在前端插入临时消息
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
  
          // a) 生成一个临时 ID
          
  
          // b) 构造本地消息对象
          const newMessage: Message = {
            id: newMessageId||realId,
            content,
            publisher,
  
            // 如果是用户，就带上本地用户名；如果是 AI，就带上 model 信息
            userName: publisher === "user"?(username ?? undefined) : undefined,
            modelId: publisher === "ai" ? modelDetails?.id : undefined,
            modelConfig: publisher === "ai" ? { ...modelDetails } : undefined,
  
            replies: [],
            isCollapsed: false,
            userCollapsed: false,
          };
  
          // 选中这条消息
          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: newMessage.id }));
  
          // c) 插入树形结构
          function addReplyToMessage(msg: Message): Message {
            if (msg.id === parentId) {
              return { ...msg, replies: [...msg.replies, newMessage] };
            }
            return {
              ...msg,
              replies: msg.replies.map(addReplyToMessage),
            };
          }
  
          // 如果没有 parentId，就插在根节点
          if (!parentId) {
            return { ...thread, messages: [...thread.messages, newMessage] };
          }
  
          // 否则找到 parentId 在它的 replies 里插入
          return {
            ...thread,
            messages: thread.messages.map(addReplyToMessage),
          };
        })
      );
  
      // 2) 调后端 /api/messages 写入数据库
      (async () => {
        try {
          const response = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id:realId, 
              threadId,
              parentId,
              publisher,
              content,
              
            }),
          });
  
          if (!response.ok) {
            throw new Error("Failed to create message");
          }
  
        } catch (error) {
          console.error("addMessage failed:", error);
          // 如果想回滚插入的临时消息，可在这里做 setThreads() 移除 tempId
        }
      })();
    },
    [setThreads, setSelectedMessages, currentThread,username]
  );
  

  // Change the model
  const handleModelChange = useCallback(
    (field: keyof Model, value: string | number | Partial<ModelParameters> | Tool[]) => {
      if (editingModel) {
        setEditingModel((prevModel) => {
          if (!prevModel) return prevModel;
          if (field === "parameters") {
            return {
              ...prevModel,
              parameters: {
                ...prevModel.parameters,
                ...(value as Partial<ModelParameters>),
              },
            };
          }
          return { ...prevModel, [field]: value };
        });
      }
    },
    [editingModel, setEditingModel]
  );

  // Find a message and its parents
  const findMessageAndParents = useCallback(
    (
      messages: Message[],
      targetId: string,
      parents: Message[] = []
    ): [Message | null, Message[]] => {
      for (const message of messages) {
        if (message.id === targetId) {
          return [message, parents];
        }
        const [found, foundParents] = findMessageAndParents(
          message.replies,
          targetId,
          [...parents, message]
        );
        if (found) {
          return [found, foundParents];
        }
      }
      return [null, []];
    },
    []
  );

  // Get siblings of a message
  const getSiblings = useCallback(
    (messages: Message[], messageId: string): Message[] => {
      for (const message of messages) {
        if (message.id === messageId) {
          return messages;
        }
        const siblings = getSiblings(message.replies, messageId);
        if (siblings.length > 0) {
          return siblings;
        }
      }
      return [];
    },
    []
  );

  // Start editing a thread title
  const startEditingThreadTitle = useCallback(
    (threadId: string, currentTitle: string) => {
      setEditingThreadTitle(threadId);
      setOriginalThreadTitle(currentTitle);
    },
    [setEditingThreadTitle, setOriginalThreadTitle]
  );

  // Save thread to backend
/*   const saveThreadToBackend = useCallback(
    async (threadId: string, updatedData: Partial<Thread>) => {
      try {
        // Cache the thread data to local storage
        const cachedThreads = storage.get("threads") || "[]"
        const updatedThreads = cachedThreads.map((thread: Thread) =>
          thread.id === threadId ? { ...thread, ...updatedData } : thread
        );
        storage.set("threads", updatedThreads);

        // Only update the backend if apiBaseUrl is available
        if (apiBaseUrl) {
          const lastUpdateTime = parseInt(
            storage.get("lastThreadUpdateTime") || "0"
          );
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime > 60000) {
            // Update every 60 seconds
            const response = await fetch(`/api/threads`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ threadId, thread: { ...updatedData } }),
            });
            if (!response.ok) {
              throw new Error(`editthread ${threadId} fail`);
            }
            storage.set(
              "lastThreadUpdateTime",
              currentTime.toString()
            );
          }
        }
      } catch (error) {
        console.error(`update ${threadId} datafail:`, error);
      }
    },
    []
  ); */
  const SaveThreadToBackend = useCallback(async (threadId: string, updatedData: Partial<Thread>) => {
    console.log("Front-end: calling fetch PATCH /api/threads/[id]", { threadId, updatedData });
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      console.log("Front-end: response status:", res.status);
      if (!res.ok) {
        throw new Error(`Failed to update thread ${threadId}`);
      }
      const data = await res.json();
      console.log("Front-end: success, server returned data:", data);
      return data.thread;
    } catch (error) {
      console.error("Front-end: error in SaveThreadToBackend:", error);
      throw error;
    }
  }, []);
  

  const debouncedSaveThreadToBackend = useMemo(() => {
    return debounce(
      async (threadId: string, updatedData: Partial<Thread>) => {
        await SaveThreadToBackend(threadId, updatedData);
      },
      2000 // 2 秒
    );
  }, [SaveThreadToBackend]);

  // Confirm editing a thread title
  const confirmEditThreadTitle = useCallback(
    (threadId: string, newTitle: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) =>
          thread.id === threadId ? { ...thread, title: newTitle } : thread
        )
      );
      setEditingThreadTitle(null);
      setOriginalThreadTitle(newTitle);
      console.log("Attempting to save thread to backend:", {
        threadId,
        newTitle,
      });
  
      debouncedSaveThreadToBackend(threadId, { title: newTitle });
    },
    [
      debouncedSaveThreadToBackend,
      setEditingThreadTitle,
      setOriginalThreadTitle,
      setThreads,
    ]
  );

  // Start editing a message
  const startEditingMessage = useCallback(
    (message: Message) => {
      setEditingMessage(message.id);
      if (typeof message.content === "string") {
        setEditingContent(message.content);
      } else {
        // 把 contentPart[] -> JSON
        setEditingContent(JSON.stringify(message.content, null, 2));
      }
    },
    [setEditingContent, setEditingMessage]
  );

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
    }
  }, [
    editingThreadTitle,
    originalThreadTitle,
    setEditingThreadTitle,
    setThreads,
  ]);

  // Add a new message
  const addEmptyReply = useCallback(
    (threadId: string, parentId: string | null) => {
      const newId=uuidv4();

      addMessage(threadId, parentId, "", "user", newId);

      startEditingMessage({
        id: newId,
        content: "",
        publisher: "user",
        replies: [],
        isCollapsed: false,
        userCollapsed: false,
      });

      const newMessageElement = document.getElementById(
        `message-${newId}`
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

  // Delete a message
  const deleteMessage = useCallback(
    (threadId: string, messageId: string, deleteOption: boolean | 'clear') => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;

          const removeMessage = (messages: Message[]): Message[] => {
            const [messageToDelete, parentMessages] = findMessageAndParents(
              messages,
              messageId
            );
            if (!messageToDelete) return messages;

            const filterAndMerge = (msgs: Message[]) => {
              if (deleteOption === true) {
                // Delete with all replies
                return msgs.filter((m) => m.id !== messageId);
              } else if (deleteOption === 'clear') {
                // Clear children but keep message
                return msgs.map(m =>
                  m.id === messageId
                    ? { ...m, replies: [] }
                    : m
                );
              } else {
                // Keep replies
                return [
                  ...msgs.filter((m) => m.id !== messageId),
                  ...messageToDelete.replies,
                ];
              }
            };

            const updateSelection = (
              newMsgs: Message[],
              parentMsg?: Message
            ) => {
              if (deleteOption !== 'clear') {
                if (parentMsg) {
                  setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: parentMsg.id }));
                } else {
                  setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }));
                }
              }
            };

            if (parentMessages.length === 0) {
              // Message is at the root level
              const newMessages = filterAndMerge(messages);
              updateSelection(newMessages);
              return newMessages;
            }

            // Message is nested
            const updateParent = (message: Message): Message => {
              if (message.id === parentMessages[parentMessages.length - 1].id) {
                const newReplies = filterAndMerge(message.replies);
                updateSelection(newReplies, message);
                return { ...message, replies: newReplies };
              }
              return { ...message, replies: message.replies.map(updateParent) };
            };

            return messages.map(updateParent);
          };

          return { ...thread, messages: removeMessage(thread.messages) };
        })
      );
    },
    [setSelectedMessages, findMessageAndParents, currentThread, setThreads]
  );

  // Toggle message collapse state
  const toggleCollapse = useCallback(
    (threadId: string, messageId: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const toggleMessage = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === messageId) {
                return {
                  ...message,
                  isCollapsed: !message.isCollapsed,
                  userCollapsed: !message.isCollapsed,
                };
              }
              return { ...message, replies: toggleMessage(message.replies) };
            });
          };
          return { ...thread, messages: toggleMessage(thread.messages) };
        })
      );
    },
    [setThreads]
  );

  // Add helper function to deep clone a message and its replies with new IDs
  const cloneMessageWithNewIds = useCallback((message: Message): Message => {

    const newId = Date.now().toString() + Math.random().toString(36).slice(2);
    return {
      ...message,
      id: newId,
      replies: message.replies.map((reply) => cloneMessageWithNewIds(reply)),
    };
  }, []);

  // Add copy/cut function
  const copyOrCutMessage = useCallback(
    (threadId: string, messageId: string, operation: "copy" | "cut") => {
      setThreads((prev) => {
        const thread = prev.find((t) => t.id === threadId);
        if (!thread) return prev;

        const [message] = findMessageAndParents(thread.messages, messageId);
        if (!message) return prev;

        navigator.clipboard.writeText(
          typeof message.content === "string" ? message.content : JSON.stringify(message.content)
        );

        setClipboardMessage({
          message: cloneMessageWithNewIds(message),
          operation,
          sourceThreadId: threadId,
          originalMessageId: messageId,
        });
        clearGlowingMessages();
        addGlowingMessage(messageId);

        return prev;
      });
    },
    [
      cloneMessageWithNewIds,
      findMessageAndParents,
      setClipboardMessage,
      clearGlowingMessages,
      addGlowingMessage,
      setThreads,
    ]
  );

  // Cancel editing a message
  const cancelEditingMessage = useCallback(() => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        const removeEmptyMessage = (messages: Message[]): Message[] => {
          if (!messages) return [];
          return messages.reduce((acc: Message[], message) => {
            if (message.id === editingMessage && (typeof message.content === "string"
              ? !message.content.trim()
              : (Array.isArray(message.content) && message.content.length === 0))) {
              // 如果是空的
              deleteMessage(thread.id, message.id, false);
              return acc;
            }
            return [...acc,{...message, replies: removeEmptyMessage(message.replies) }];
          }, []);
        };
        return { ...thread, messages: removeEmptyMessage(thread.messages) };
      })
    );
    setEditingMessage(null);
    setEditingContent("");
  }, [
    editingMessage,
    deleteMessage,
    setEditingContent,
    setEditingMessage,
    setThreads,
  ]);

  const fetchModelParameters = async (modelId: string) => {
    // console.log(`Fetching parameters for model ID: ${modelId}`);
    try {
      const response = await fetch(
        `/api/model-parameters?modelId=${encodeURIComponent(modelId)}`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch model parameters: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();

      // Find the corresponding model in availableModels to get the max_output
      const selectedModel = availableModels.find(
        (model) => model.id === modelId
      );
      if (selectedModel && selectedModel.parameters?.max_output) {
        data.max_output = selectedModel.parameters.max_output;
      }

      return data;
    } catch (error) {
      console.error("Error fetching model parameters:", error);
      throw error;
    }
  };

  const saveModelChanges = useCallback(() => {
    if (editingModel) {
      const updatedModel = {
        ...editingModel,
        parameters: {
          ...editingModel.parameters,
          tools: editingModel.parameters?.tools || [],
          tool_choice: editingModel.parameters?.tool_choice || "none"
        }
      };
      setModels((prev) =>
        prev.map((model) => model.id === editingModel.id ? updatedModel : model)
      );
      setEditingModel(null);
    }
  }, [editingModel, setEditingModel, setModels]);

  const deleteModel = useCallback(
    (id: string) => {
      setModels((prev: any[]) =>
        prev.filter((model: { id: string }) => model.id !== id)
      );
      // If the deleted model was selected, switch to the first available model
      if (selectedModels.includes(id)) {
        setSelectedModels(models[0] ? [models[0].id] : []);
      }
    },
    [models, selectedModels, setModels, setSelectedModels]
  );

  const addNewModel = useCallback(() => {
    const newId = uuidv4();
    const newModel: Model = {
      id: newId,
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
  }, [setEditingModel, setModels]);

  const toggleThreadPin = useCallback(
    async (threadId: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, isPinned: !thread.isPinned }
            : thread
        )
      );
      try {
        const currentThread = threads.find((t) => t.id === threadId);
        const newPinnedValue = currentThread ? !currentThread.isPinned : true;
        await fetch("/api/membership/insertpin", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId,
            pinned: newPinnedValue,
          }),
        });
        // 如果需要的话，还可以再做后端返回的 pinned 校正
      } catch (error) {
        console.error("Failed to toggle pinned state:", error);
        // 失败时，可以尝试回滚 pinned 状态
      }
    },
    [threads, setThreads]
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      // 1) 先发请求到后端，“真正”删除
      let ok = false;
      try {
        const res = await fetch(`/api/delete_thread/${threadId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          throw new Error(`Failed to delete thread ${threadId}, status = ${res.status}`);
        }
        // 如果成功就标记 ok = true
        ok = true;
        console.log(`[deleteThread] server delete success, threadId=${threadId}`);
      } catch (error) {
        console.error(`[deleteThread] server delete fail, threadId=${threadId}:`, error);
      }
  
      // 2) 如果后端成功，再更新前端 threads
      if (ok) {
        setThreads((prevThreads) => {
          const updatedThreads = prevThreads.filter((t) => t.id !== threadId);
  
          // 如果正好是当前选中，换到别的
          if (currentThread === threadId) {
            const currentIndex = prevThreads.findIndex((t) => t.id === threadId);
            const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
            setCurrentThread(
              updatedThreads.length > 0
                ? updatedThreads[newIndex]?.id || null
                : null
            );
          }
  
          return updatedThreads;
        });
      }
    },
    [currentThread, setThreads, setCurrentThread]
  );
  
  

  // Update message content
  const updateMessageContent = useCallback(
    (threadId: string, messageId: string, newContent: string | ContentPart[]) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const updateContent = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === messageId) {
                if (typeof newContent === "string") {
                  // 这时直接更新成 string
                  return { ...message, content: newContent };
                } else {
                  // 这是 ContentPart[]，做更多校验或合并都可以
                  return { ...message, content: newContent };
                }
              }
              return { ...message, replies: updateContent(message.replies) };
            });
          };
          return { ...thread, messages: updateContent(thread.messages) };
        })
      );
    },
    [setThreads]
  );

  // Find message by ID
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

  const pasteMessage = useCallback(
    (threadId: string, parentId: string | null) => {
      const newId=uuidv4();

      const messageToPaste = clipboardMessage?.message || {
        id: newId + Math.random().toString(36).slice(2),
        content: "", // Initialize with empty string
        isCollapsed: false,
        userCollapsed: false,
        replies: [],
        publisher: "user"
      };

      if (!clipboardMessage) {
        navigator.clipboard.readText().then(text => {
          updateMessageContent(threadId, messageToPaste.id, text);
        });
      }

      // Prevent pasting on the original message or its children
      if (clipboardMessage && clipboardMessage.originalMessageId) {
        const originalMessage = findMessageById(
          threads.find(t => t.id === clipboardMessage.sourceThreadId)?.messages || [],
          clipboardMessage.originalMessageId
        );

        // Check if parentId matches original message or any of its descendants
        const isDescendant = (message: Message | null): boolean => {
          if (!message) return false;
          if (message.id === parentId) return true;
          return message.replies.some(reply => isDescendant(reply));
        };

        if (originalMessage && clipboardMessage.operation === "cut" && (parentId === clipboardMessage.originalMessageId || isDescendant(originalMessage))) {
          window.alert("Cut and paste on children is now allowed!")
          return;
        }
      }

      setThreads((prev) => {
        let updatedThreads = [...prev];

        // Then handle the paste operation
        return updatedThreads.map((thread) => {
          if (thread.id !== threadId) return thread;

          // If thread has no messages array, initialize it
          if (!thread.messages) {
            thread.messages = [];
          }

          // If no parentId is provided or thread is empty, paste at the root level
          if (!parentId || thread.messages.length === 0) {
            return {
              ...thread,
              messages: [...thread.messages, messageToPaste],
            };
          }

          // Otherwise, paste as a reply to the specified parent
          const addMessageToParent = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === parentId) {
                return {
                  ...message,
                  isCollapsed: false,
                  userCollapsed: false,
                  replies: [...message.replies, messageToPaste],
                };
              }
              return {
                ...message,
                replies: addMessageToParent(message.replies),
              };
            });
          };

          return {
            ...thread,
            messages: addMessageToParent(thread.messages),
          };
        });
      });

      if (currentThread) {
        setSelectedMessages((prev) => ({
          ...prev,
          [currentThread]: messageToPaste.id
        }));
      }

      if (clipboardMessage?.operation === "cut" || clipboardMessage?.operation === "copy") {
        setClipboardMessage(null); // Set clipboardMessage to null after paste for cut/copy operation
        clearGlowingMessages();
      }

      if (
        clipboardMessage?.operation === "cut" &&
        clipboardMessage.sourceThreadId &&
        clipboardMessage.originalMessageId
      ) {
        deleteMessage(
          clipboardMessage.sourceThreadId,
          clipboardMessage.originalMessageId,
          true
        );
      }

    },
    [clipboardMessage, setClipboardMessage, clearGlowingMessages, setSelectedMessages, deleteMessage, updateMessageContent, findMessageById, threads, currentThread, setThreads]
  );

  // Collapse deep children
  const collapseDeepChildren = useCallback(
    (
      msg: Message,
      selectedDepth: number,
      currentDepth: number,
      isSelectedBranch: boolean
    ): Message => {
      const maxDepth =
        window.innerWidth >= 1024
          ? 8
          : window.innerWidth >= 768
            ? 7
            : window.innerWidth >= 480
              ? 6
              : 5;

      const shouldAutoCollapse = isSelectedBranch
        ? currentDepth - selectedDepth >= maxDepth
        : currentDepth >= maxDepth;

      return {
        ...msg,
        isCollapsed: msg.userCollapsed || shouldAutoCollapse,
        replies: msg.replies.map((reply) =>
          collapseDeepChildren(
            reply,
            selectedDepth,
            currentDepth + 1,
            isSelectedBranch
          )
        ),
      };
    },
    []
  );

  // Generate AI reply
  const generateAIReply = useCallback(
    async (threadId: string, messageId: string, count: number = 1) => {
      const messageAbortController = new AbortController();
      const cleanup = () => {
        messageAbortController.abort();
        setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
      };

      if (isGenerating[messageId] && messageAbortController) {
        cleanup();
        return;
      }

      const thread = threads.find((t: { id: string }) => t.id === threadId);
      if (!thread) return;

      const message = findMessageById(thread.messages, messageId);
      if (!message) return;

      try {
        const selectedModelIds = selectedModels;
        if (selectedModelIds.length === 0) return;

        for (let i = 0; i < count; i++) {
          const promises = selectedModelIds.map(async (modelId) => {
            const model = models.find((m) => m.id === modelId);
            if (!model) return;

            if (!isSignedIn && !model.baseModel.endsWith(":free")) {
              alert(`Sign in to use ${model.baseModel}`);
              return;
            }
            const newId=uuidv4();

            const newMessageId = newId + Math.random().toString(36).slice(2);
            // Pass the model details when creating the message
            addMessage(threadId, messageId, "", "ai", newMessageId, model);
            setIsGenerating((prev) => ({ ...prev, [newMessageId]: true }));

            let fullResponse = "";
            try {
              const enabledTools = (model.parameters?.tool_choice !== "none" && model.parameters?.tool_choice !== undefined
                ? model.parameters?.tools ?? []
                : []) as Tool[];
                let finalContent: string;

                if (typeof message.content === "string") {
                  // 如果本来就是字符串，就直接保留
                  finalContent = message.content;
                } else {
                  // 如果是 ContentPart[] 或别的，就转换
                  finalContent = JSON.stringify(message.content);
                }
              await generateAIResponse(
                finalContent,
                message.publisher,
                model,
                threads,
                threadId,
                messageId,
                enabledTools,
                (chunk) => {
                  const lines = chunk.split("\n");
                  for (const line of lines) {
                    if (line.startsWith("data:")) {
                      const dataStr = line.replace("data:", "").trim();
                      if (dataStr === "[DONE]") return;
                      try {
                        const data = JSON.parse(dataStr);
                        const delta = data.choices[0].delta || {};
                        if (delta.content) {
                          fullResponse += delta.content;
                          updateMessageContent(threadId, newMessageId, fullResponse);
                        }
                      } catch (error) {
                        console.error("Error parsing chunk:", error);
                      }
                    }
                  }
                },
                messageAbortController
              );
            } finally {
              setIsGenerating((prev) => ({ ...prev, [newMessageId]: false }));
            }
          });
          await Promise.all(promises);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // console.log('Generation aborted');
        } else {
          console.error("Failed to generate AI response:", error);
        }
      }
    },
    [
      threads,
      models,
      selectedModels,
      addMessage,
      findMessageById,
      updateMessageContent,
      isGenerating
    ]
  );

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
      /*   const cachedThreads = await storage.getLarge("threads");
        if (cachedThreads) {
          setThreads(cachedThreads);
          return;
        } */

        /* if (!apiBaseUrl) {
          const newId=uuidv4();
          const defaultThread = {
            id: newId,
            title: "Welcome Thread",
            isPinned: false,
            messages: [
              {
                id: newId,
                content:
                  "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
                publisher: "ai" as const,
                replies: [],
                isCollapsed: false,
                userCollapsed: false,
              },
            ],
          };
          setThreads([defaultThread]);
          storage.set("threads", [defaultThread]);
          return;
        } */

        const response = await fetch(`/api/threads`, {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          const loadedThreads = data.threads || [];
          setThreads(loadedThreads);
          storage.set("threads", loadedThreads);
        } else {
          throw new Error("Failed to load threads from backend");
        }
      } catch (error) {
        console.error("Load failed:", error);
        const newId=uuidv4();

        const defaultThread = {
          id: newId,
          title: "Welcome Thread",
          isPinned: false,
          messages: [
            {
              id: newId,
              content:
                "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
              publisher: "ai" as const,
              replies: [],
              isCollapsed: false,
              userCollapsed: false,
            },
          ],
        };
        setThreads([defaultThread]);
        storage.set("threads", [defaultThread]);
      }
    };

    loadThreads();
  }, [setThreads]);

  // Focus on thread title input when editing
  useEffect(() => {
    if (editingThreadTitle && threadTitleInputRef.current) {
      threadTitleInputRef.current.focus();
    }
  }, [editingThreadTitle]);

  // Scroll to selected message
  useEffect(() => {
    if (currentThread && selectedMessages[currentThread]) {
      const messageElement = document.getElementById(
        `message-${selectedMessages[currentThread]}`
      );
      if (messageElement) {
        // Check if element is fully in view
        const rect = messageElement.getBoundingClientRect();
        const isInView = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        // Only scroll if not fully in view
        if (!isInView) {
          messageElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    }
  }, [selectedMessages, currentThread]);

  // Scroll to reply box when replying
  useEffect(() => {
    if (replyBoxRef.current) {
      replyBoxRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [replyingTo]);

  /*   // Connect to backend on component mount
    useEffect(() => {
      const connectToBackend = async () => {
        if (!apiBaseUrl) return;
  
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
    */
  // Save threads
/*   useEffect(() => {
    debouncedSaveThreads(threads);
    return () => {
      debouncedSaveThreads.cancel();
    };
  }, [threads, debouncedSaveThreads]); */

  /*   useEffect(() => {
      const savedScroll = storage.get('scrollPosition');
      if (savedScroll) {
        setScrollPosition(Number(savedScroll));
      }
    }, []);
  
    useEffect(() => {
      storage.set('scrollPosition', scrollPosition.toString());
    }, [scrollPosition]);
   */
  // Load selected message for the current thread
  useEffect(() => {
    if (currentThread) {
      const savedSelectedMessage = storage.get(`selectedMessage-${currentThread}`);
      if (savedSelectedMessage) {
        setSelectedMessages((prev) => ({ ...prev, [currentThread]: savedSelectedMessage }));
      }
    }
  }, [currentThread, setCurrentThread, setSelectedMessages]);

  // Save selected message for the current thread
  useEffect(() => {
    if (currentThread) {
      storage.set(`selectedMessage-${currentThread}`, selectedMessages[currentThread] || '');
    }
  }, [selectedMessages, currentThread]);

  // Add new thread
  useEffect(() => {
    const loadModels = async () => {
      // First, try to load models from cache
      const cachedModels = storage.get("models");
      if (cachedModels) {
        setModels(cachedModels);
        setModelsLoaded(true);
        // Don't override selectedModels from cache since useModels handles that
      }

      if (!apiBaseUrl) {
        // If no apiBaseUrl, ensure default model is set
        if (!cachedModels) {
          setModels([DEFAULT_MODEL]);
          setModelsLoaded(true);
          setSelectedModels([DEFAULT_MODEL.id]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/models`, {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          let loadedModels = data.models || [];

          // If no models are loaded, add the default model
          if (loadedModels.length === 0) {
            loadedModels = [DEFAULT_MODEL];
          }

          setModels(loadedModels);
          setModelsLoaded(true);
          // Let useModels handle selectedModels initialization

          // Update cache with the newly fetched models
          storage.set("models", loadedModels);
        } else {
          console.error("Failed to load models from backend.");
          // Ensure default model is set if loading fails and no cache exists
          if (!cachedModels) {
            setModels([DEFAULT_MODEL]);
            setModelsLoaded(true);
            // Let useModels handle selectedModels initialization
          }
        }
      } catch (error) {
        console.error("Error loading models:", error);
        // Ensure default model is set if an error occurs and no cache exists
        if (!cachedModels) {
          setModels([DEFAULT_MODEL]);
          setModelsLoaded(true);
          // Let useModels handle selectedModels initialization
        }
      }
    };

    loadModels();
  }, [setModels, setModelsLoaded, setSelectedModels]);

  // fetch available models
  useEffect(() => {
    const saveModels = async () => {
      if (!apiBaseUrl) {
        // Cache models to browser storage if apiBaseUrl is not present
        storage.set("models", models);
        return;
      }

      try {
        await fetch(`/api/models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ models }),
        });
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

  useEffect(() => {
    if (currentThread && selectedMessages[currentThread]) {
      setThreads((prevThreads) =>
        prevThreads.map((thread) => {
          if (thread.id === currentThread) {
            const findSelectedMessageBranch = (
              messages: Message[],
              depth: number = 0
            ): [number, Message[]] => {
              for (const msg of messages) {
                if (msg.id === selectedMessages[currentThread]) return [depth, [msg]];
                const [foundDepth, branch] = findSelectedMessageBranch(
                  msg.replies,
                  depth + 1
                );
                if (foundDepth !== -1) return [foundDepth, [msg, ...branch]];
              }
              return [-1, []];
            };

            const [selectedDepth, selectedBranch] = findSelectedMessageBranch(
              thread.messages
            );

            return {
              ...thread,
              messages: thread.messages.map((msg) => {
                const isSelectedBranch = selectedBranch.includes(msg);
                return collapseDeepChildren(
                  msg,
                  selectedDepth,
                  0,
                  isSelectedBranch
                );
              }),
            };
          }
          return thread;
        })
      );
    }
  }, [selectedMessages, currentThread, setThreads, collapseDeepChildren]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // Handle special input cases first
      if (isInputFocused) {
        // Thread title editing
        if (editingThreadTitle && activeElement.id === `thread-title-${editingThreadTitle}`) {
          if (event.key === 'Enter') {
            event.preventDefault();
            setEditingThreadTitle(null);
          }
          else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditThreadTitle();
          }
          return;
        }

        // Message editing
        if (editingMessage && activeElement.id === `message-edit-${editingMessage}`) {
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

        // Model editing
        if (editingModel && (activeElement.id === `model-textarea-${editingModel.id}` || activeElement.id === `model-title-${editingModel.id}`)) {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            saveModelChanges();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setEditingModel(null);
          }
          return;
        }
        return;
      }

      // Handle thread-level operations
      if (currentThread) {
        const key = event.key.toLowerCase();
        const selectedMessage = selectedMessages[currentThread];

        // Copy/Cut/Paste operations
        if ((event.metaKey || event.ctrlKey)) {
          if (selectedMessage && key === 'c') {
            event.preventDefault();
            copyOrCutMessage(currentThread, selectedMessage, "copy");
            return;
          }
          if (selectedMessage && key === 'x') {
            event.preventDefault();
            copyOrCutMessage(currentThread, selectedMessage, "cut");
            return;
          }
          if (key === 'v') {
            event.preventDefault();
            pasteMessage(currentThread, selectedMessage || null);
            return;
          }
        }

        // New message at root level
        if (key === 'n') {
          event.preventDefault();
          addEmptyReply(currentThread, null);
          return;
        }
      }

      // Handle message-level operations
      if (currentThread && selectedMessages[currentThread] && !isInputFocused) {
        const selectedMessage = selectedMessages[currentThread]
        const currentThreadData = threads.find((t) => t.id === currentThread);
        if (!currentThreadData) return;

        const [currentMessage, parentMessages] = findMessageAndParents(currentThreadData.messages, selectedMessage);
        if (!currentMessage) return;

        const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
        const siblings = getSiblings(currentThreadData.messages, selectedMessage);
        const currentIndex = siblings.findIndex((m) => m.id === currentMessage.id);
        const message = findMessageById(currentThreadData.messages, selectedMessage);

        // Navigation keys
        switch (event.key) {
          case "ArrowLeft":
            if (parentMessage) {
              event.preventDefault();
              setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: parentMessage.id }));
            }
            break;
          case "ArrowRight":
            if (currentMessage.replies.length > 0) {
              event.preventDefault();
              setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: currentMessage.replies[0].id }));
              if (currentMessage.isCollapsed) {
                toggleCollapse(currentThread, currentMessage.id);
              }
            }
            break;
          case "ArrowUp":
            if (currentIndex > 0) {
              event.preventDefault();
              setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: siblings[currentIndex - 1].id }));
            }
            break;
          case "ArrowDown":
            if (currentIndex < siblings.length - 1) {
              event.preventDefault();
              setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: siblings[currentIndex + 1].id }));
            }
            break;

          // Action keys  
          case "r":
            event.preventDefault();
            if (message && message.isCollapsed) {
              toggleCollapse(currentThread, selectedMessage);
            }
            addEmptyReply(currentThread, selectedMessage);
            break;
          case "Enter":
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              if (message && message.isCollapsed) {
                toggleCollapse(currentThread, selectedMessage);
              }
              generateAIReply(currentThread, selectedMessage, lastGenerateCount);
            } else {
              event.preventDefault();
              if (message && message.isCollapsed) {
                toggleCollapse(currentThread, selectedMessage);
              }
              generateAIReply(currentThread, selectedMessage);
            }
            break;
          case "c":
            event.preventDefault();
            toggleCollapse(currentThread, selectedMessage);
            break;
          case "e":
            if (!editingMessage || editingMessage !== selectedMessage) {
              event.preventDefault();
              const message = findMessageById(currentThreadData.messages, selectedMessage);
              if (message) {
                startEditingMessage(message);
              }
            }
            break;
          case "Escape":
            if (clipboardMessage) {
              clearGlowingMessages();
              setClipboardMessage(null);
            }
            else setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }))
            break;
          case "Delete":
          case "Backspace":
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
              deleteMessage(currentThread, selectedMessage, true);
            } else if (event.altKey) {
              deleteMessage(currentThread, selectedMessage, 'clear');
            } else {
              deleteMessage(currentThread, selectedMessage, false);
            }
            break;
          case "Tab":
            event.preventDefault();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedMessages,
    editingMessage,
    currentThread,
    editingThreadTitle,
    cancelEditThreadTitle,
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
    clipboardMessage,
    copyOrCutMessage,
    findMessageAndParents,
    getSiblings,
    pasteMessage,
    setClipboardMessage,
    setEditingModel,
    setEditingThreadTitle,
    setSelectedMessages,
    clearGlowingMessages,
    toggleCollapse,
    lastGenerateCount
  ]);

  return (
    <div className="h-screen flex flex-col md:flex-row p-2 pb-0 md:pr-0 overflow-ellipsis ">
      <div className="sm:hidden bg-transparent">
        {/* Mobile layout with tabs for threads, messages, and models */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "threads" | "messages" | "models" | "tools" | "settings")
          }
          className="w-full flex flex-col"
        >
          <TabsContent
            value="threads"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <ThreadList
              threads={threads}
              currentThread={currentThread}
              setCurrentThread={setCurrentThread}
              startEditingThreadTitle={startEditingThreadTitle}
              confirmEditThreadTitle={confirmEditThreadTitle}
              cancelEditThreadTitle={cancelEditThreadTitle}
              toggleThreadPin={toggleThreadPin}
              deleteThread={deleteThread}
              editingThreadTitle={editingThreadTitle}
              addThread={addThread}
              setSelectedMessages={setSelectedMessages}
              setThreads={setThreads}
              threadToDelete={threadToDelete}
              setThreadToDelete={setThreadToDelete}
              newThreadId={newThreadId}
              setNewThreadId={setNewThreadId}
            />
          </TabsContent>
          <TabsContent
            value="messages"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <RenderMessages
              threads={threads}
              currentThread={currentThread}
              selectedMessages={selectedMessages}
              editingMessage={editingMessage}
              editingContent={editingContent}
              glowingMessageIds={glowingMessageIds}
              addGlowingMessage={addGlowingMessage}
              removeGlowingMessage={removeGlowingMessage}
              clearGlowingMessages={clearGlowingMessages}
              copiedStates={copiedStates}
              clipboardMessage={clipboardMessage}
              isGenerating={isGenerating}
              setSelectedMessages={setSelectedMessages}
              toggleCollapse={toggleCollapse}
              setEditingContent={setEditingContent}
              confirmEditingMessage={confirmEditingMessage}
              cancelEditingMessage={cancelEditingMessage}
              startEditingMessage={startEditingMessage}
              addEmptyReply={addEmptyReply}
              generateAIReply={generateAIReply}
              copyOrCutMessage={copyOrCutMessage}
              pasteMessage={pasteMessage}
              deleteMessage={deleteMessage}
              findMessageById={findMessageById}
              findMessageAndParents={findMessageAndParents}
              getSiblings={getSiblings}
              getModelDetails={getModelDetails}
              setCopiedStates={setCopiedStates}
              setThreads={setThreads}
              setClipboardMessage={setClipboardMessage}
              lastGenerateCount={lastGenerateCount}
              setLastGenerateCount={setLastGenerateCount}
            />
          </TabsContent>
          <TabsContent
            value="models"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <ModelConfig
              models={models}
              selectedModels={selectedModels}
              setSelectedModels={setSelectedModels}
              addNewModel={addNewModel}
              fetchAvailableModels={fetchAvailableModels}
              fetchModelParameters={fetchModelParameters}
              deleteModel={deleteModel}
              saveModelChanges={saveModelChanges}
              editingModel={editingModel}
              setEditingModel={setEditingModel}
              handleModelChange={handleModelChange}
              availableTools={availableTools}
              isSignedIn={isSignedIn}
            />
          </TabsContent>
          <TabsContent
            value="tools"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <ToolManager
              tools={tools}
              setTools={setTools}
              isLoading={toolsLoading}
              error={toolsError}
              availableTools={availableTools}
              setAvailableTools={setAvailableTools}
            />
          </TabsContent>
          <TabsContent
            value="settings"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <SettingsPanel />
          </TabsContent>
          <TabsList
            className="grid 
              bg-background/80
              custom-shadow
              w-full 
              fixed 
              bottom-0 
              left-0 
              right-0 
              pb-16
              space-x-1
              grid-cols-5
              select-none"
/*             style={{
              paddingBottom: `${parseInt('env(safe-area-inset-bottom)') > 0 ? '64px' : '40px'}`
            }}
 */          >
            <TabsTrigger
              value="threads"
              className="bg-transparent data-[state=active]:bg-secondary/80"
            >
              <AlignJustify className="h-6 w-6" />
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="bg-transparent data-[state=active]:bg-secondary/80"
            >
              <MessageSquare className="h-6 w-6" />
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="bg-transparent data-[state=active]:bg-secondary/80"
            >
              <Sparkle className="h-6 w-6" />
            </TabsTrigger>
            <TabsTrigger
              className="bg-transparent data-[state=active]:bg-secondary/80"
              value="tools"
            >
              <Package className="h-6 w-6" />
            </TabsTrigger>
            <TabsTrigger
              className="bg-transparent data-[state=active]:bg-secondary/80"
              value="settings"
            >
              <Settings className="h-6 w-6" />
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
        <ResizablePanelGroup direction="horizontal" className="flex-grow">
          <ResizablePanel
            defaultSize={28}
            collapsible
            collapsedSize={0}
            minSize={15}
            maxSize={56}
            style={{ transition: 'all 0.1s ease-out' }}
          >
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "threads" | "models" | "tools" | "settings")
              }
              className="w-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-4 bg-transparent space-x-1 py-0 custom-shadow select-none">
                <TabsTrigger
                  className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="threads"
                >
                  <AlignJustify className="h-5 w-5 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute">Threads</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="models"
                >
                  <Sparkle className="h-5 w-5 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute">Models</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="tools"
                >
                  <Package className="h-5 w-5 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute">Tools</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="settings"
                >
                  <Settings className="h-5 w-5 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute">Settings</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="threads"
                className="flex-grow overflow-y-clip"
              >
                <ThreadList
                  threads={threads}
                  currentThread={currentThread}
                  setCurrentThread={setCurrentThread}
                  startEditingThreadTitle={startEditingThreadTitle}
                  threadToDelete={threadToDelete}
                  setThreadToDelete={setThreadToDelete}
                  confirmEditThreadTitle={confirmEditThreadTitle}
                  cancelEditThreadTitle={cancelEditThreadTitle}
                  toggleThreadPin={toggleThreadPin}
                  deleteThread={deleteThread}
                  editingThreadTitle={editingThreadTitle}
                  addThread={addThread}
                  setSelectedMessages={setSelectedMessages}
                  setThreads={setThreads}
                  newThreadId={newThreadId}
                  setNewThreadId={setNewThreadId}
                />
              </TabsContent>
              <TabsContent value="models" className="flex-grow overflow-y-clip">
                <ModelConfig
                  models={models}
                  selectedModels={selectedModels}
                  setSelectedModels={setSelectedModels}
                  addNewModel={addNewModel}
                  fetchAvailableModels={fetchAvailableModels}
                  fetchModelParameters={fetchModelParameters}
                  deleteModel={deleteModel}
                  saveModelChanges={saveModelChanges}
                  editingModel={editingModel}
                  setEditingModel={setEditingModel}
                  handleModelChange={handleModelChange}
                  availableTools={availableTools}
                  isSignedIn={isSignedIn}
                />
              </TabsContent>
              <TabsContent value="tools" className="flex-grow overflow-y-clip">
                <ToolManager
                  tools={tools}
                  setTools={setTools}
                  isLoading={toolsLoading}
                  error={toolsError}
                  availableTools={availableTools}
                  setAvailableTools={setAvailableTools}
                />
              </TabsContent>
              <TabsContent value="settings" className="flex-grow overflow-y-clip">
                <SettingsPanel />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle withHandle hitAreaMargins={{ coarse: 16, fine: 8 }} className="mx-2 w-0 px-px bg-gradient-to-b from-background via-transparent to-background" />
          <ResizablePanel defaultSize={72}>
            <div className="h-full overflow-y-auto">
              <RenderMessages
                threads={threads}
                currentThread={currentThread}
                selectedMessages={selectedMessages}
                editingMessage={editingMessage}
                editingContent={editingContent}
                glowingMessageIds={glowingMessageIds}
                addGlowingMessage={addGlowingMessage}
                removeGlowingMessage={removeGlowingMessage}
                clearGlowingMessages={clearGlowingMessages}
                copiedStates={copiedStates}
                clipboardMessage={clipboardMessage}
                isGenerating={isGenerating}
                setSelectedMessages={setSelectedMessages}
                toggleCollapse={toggleCollapse}
                setEditingContent={setEditingContent}
                confirmEditingMessage={confirmEditingMessage}
                cancelEditingMessage={cancelEditingMessage}
                startEditingMessage={startEditingMessage}
                addEmptyReply={addEmptyReply}
                generateAIReply={generateAIReply}
                copyOrCutMessage={copyOrCutMessage}
                pasteMessage={pasteMessage}
                deleteMessage={deleteMessage}
                findMessageById={findMessageById}
                findMessageAndParents={findMessageAndParents}
                getSiblings={getSiblings}
                getModelDetails={getModelDetails}
                setCopiedStates={setCopiedStates}
                setThreads={setThreads}
                setClipboardMessage={setClipboardMessage}
                lastGenerateCount={lastGenerateCount}
                setLastGenerateCount={setLastGenerateCount}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
