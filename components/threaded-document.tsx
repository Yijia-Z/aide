
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
import { Thread, Message, Model, ModelParameters, Tool, ContentPart,KeyInfo } from "./types";
import { useModels } from "./hooks/use-models";
import { useThreads } from "./hooks/use-threads";
import { useMessages } from "./hooks/use-messages";
import { useUser, useClerk, useSession } from "@clerk/nextjs";
import { SettingsPanel } from "./settings/settings-panel"
import { useTools } from "./hooks/use-tools";
import { useUserProfile } from "./hooks/use-userprofile";
import { AlignJustify, MessageSquare, Sparkle, Settings, Package } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';


const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ThreadedDocument() {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const { isSignedIn } = useUser();
  const { username, reloadUserProfile  } = useUserProfile();
  // const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models" | "tools" | "settings">(
    (storage.get('activeTab') || "threads") as "threads" | "messages" | "models" | "tools" | "settings"
    // !isSignedIn ? "settings" : "threads"
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


  /* useEffect(() => {
    if (!currentThread) {
      console.log("[ThreadedDocument] no currentThread => skip fetchSingleThread");
      return;
    }

    const fetchSingleThread = async () => {
      try {
        console.log("[fetchSingleThread] start => threadId =", currentThread);

      
           const resThread = await fetch(`/api/threads/${currentThread}`);
           if (!resThread.ok) {
             throw new Error("Failed to fetch thread info");
           }
           const dataThread = await resThread.json();
           console.log("[fetchSingleThread] dataThread=", dataThread);

        // 2) 获取 messages
        const resMessages = await fetch(`/api/messages?threadId=${currentThread}`);
        if (!resMessages.ok) {
          throw new Error("Failed to fetch messages for thread");
        }
        const dataMessages = await resMessages.json();
        console.log("[fetchSingleThread] dataMessages=", dataMessages);
        function initCollapse(messages: any[]): Message[] {
          return messages.map(msg => {
            // 强制赋值
            msg.isCollapsed = false;
            msg.userCollapsed = false;
            // 递归对子消息也同样处理
            if (Array.isArray(msg.replies) && msg.replies.length > 0) {
              msg.replies = initCollapse(msg.replies);
            }
            return msg;
          });
        }

        const initMessages = Array.isArray(dataMessages.messages)
          ? initCollapse(dataMessages.messages)
          : [];

        // 4) setThreads
        setThreads((prevThreads) =>
          prevThreads.map((th) => {
            if (th.id !== currentThread) {
              return th;
            }
            // 只更新 messages，保留 th 的其他字段
            return {
              ...th,
              messages: initMessages,
              // 如果你后端还有别的字段要更新，这里再写
              // 比如 updatedAt: dataThread.thread.updatedAt
              // 或 pinned 状态等等
            };
          })
        );
      } catch (err) {
        console.error("[fetchSingleThread] error =>", err);
      }
    };

    fetchSingleThread();
  }, [currentThread, setThreads]); */

  useEffect(() => {
    // 如果没选中任何 thread，就不做任何请求
    if (!currentThread) {
      console.log("[ThreadedDocument] no currentThread => skip fetchSingleThread");
      return;
    }
    const localThread = threads.find(t => t.id === currentThread)
    if (!localThread) {
      // localThread === undefined，必须 return 或 fetch
      return
    }
    if (!localThread.hasFetchedMessages) {
      fetchSingleThread(currentThread)
      return
    }
    // 1) 解析本地 thread 的 updatedAt
    console.log("localThread.updatedAt =", localThread.updatedAt);
    // 然后再写 new Date(...)

    const localUpdatedTime = new Date(localThread.updatedAt || 0).getTime();

    // 2) 先请求后端查看是否有更新的 updatedAt (轻量接口)
    //    如果你已经有 /api/threads/:id，可以只拿 { updatedAt } 再决定是否要拉 messages
    //    这里示例写个 fetchHeadThread 只返回 updatedAt
    const checkBackend = async () => {
      try {
        const res = await fetch(`/api/threads/${currentThread}?only=updatedAt`);
        if (!res.ok) throw new Error("Failed to fetch thread's updatedAt");
        const data = await res.json();
        const serverUpdatedTime = new Date(data.thread.updatedAt).getTime();

        if (serverUpdatedTime > localUpdatedTime) {
          // 说明服务器更新 => 去拉全量消息
          fetchSingleThread(currentThread);
        } else {
          // 本地已经比服务端新或相等 => 什么都不做，直接用本地
          console.log("[fetchSingleThread] local is up-to-date, skip");
        }
      } catch (err) {
        console.error("[checkBackend updatedAt] error =>", err);
        // 这里可决定：如果后端出错，就直接用本地
      }
    };

    checkBackend();
  }, [currentThread]);

  /**
   * 真正从后端拉取 messages 的函数
   * 拉取后更新 setThreads，并写进 localStorage
   */
  async function fetchSingleThread(threadId: string) {
    try {
      console.log("[fetchSingleThread] actually fetching => threadId =", threadId);

      // 1) 获取 messages
      const resMessages = await fetch(`/api/messages?threadId=${threadId}`);
      if (!resMessages.ok) {
        throw new Error("Failed to fetch messages for thread");
      }
      const dataMessages = await resMessages.json();
      console.log("[fetchSingleThread] dataMessages=", dataMessages);

      function initCollapse(messages: any[]): Message[] {
        return messages.map((msg) => {
          msg.isCollapsed = false;
          msg.userCollapsed = false;
          if (Array.isArray(msg.replies) && msg.replies.length > 0) {
            msg.replies = initCollapse(msg.replies);
          }
          return msg;
        });
      }

      const initMessages = Array.isArray(dataMessages.messages)
        ? initCollapse(dataMessages.messages)
        : [];

      // 2) 获取 thread 基本信息 (包括 updatedAt)
      //    如果你在 /api/messages 里已经返回了 thread 的 updatedAt，也可省略这一步
      //    这里仅做示例
      const resThreadInfo = await fetch(`/api/threads/${threadId}`);
      if (!resThreadInfo.ok) {
        throw new Error("Failed to fetch thread info");
      }
      const dataThread = await resThreadInfo.json();
      const serverThread = dataThread.thread; // { id, updatedAt, isPinned, etc.}

      // 3) 合并到前端 state
      setThreads((prevThreads) => {
        const newThreads = prevThreads.map((th) => {
          if (th.id !== threadId) return th;
          return {
            ...th,
            // 用后端数据更新
            updatedAt: serverThread.updatedAt,
            isPinned: serverThread.isPinned ?? th.isPinned,
            messages: initMessages,
            hasFetchedMessages: true,
          };
        });
        // 4) 写入 localStorage
        storage.set("threads", newThreads);
        return newThreads;
      });
    } catch (err) {
      console.error("[fetchSingleThread] error =>", err);
    }
  }

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

  // 你的 confirmEditingMessage
  const confirmEditingMessage = useCallback(
    async (threadId: string, messageId: string) => {
      console.log("[confirmEditingMessage] start, messageId =", messageId);

      let finalContent: ContentPart[];

      try {
        // 先尝试把编辑框内容 JSON.parse
        const maybeJson = JSON.parse(editingContent);

        if (Array.isArray(maybeJson)) {
          // 如果 parse 后确实是数组 => 说明用户在编辑框里就是写的完整 JSON
          // 这时就直接用它
          finalContent = maybeJson;
        } else {
          // 如果不是数组 => 就当纯字符串
          // 并包成 ContentPart[] 
          finalContent = [
            {
              type: "text",
              text: editingContent.trim(),
            },
          ];
        }
      } catch (err) {
        // 如果 JSON.parse 失败 => 说明用户输入的是纯文本
        finalContent = [
          {
            type: "text",
            text: editingContent.trim(),
          },
        ];
      }

      // 更新前端的 thread 数据（乐观更新）
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;

          const editMessage = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === messageId) {
                // 注意，这里 message.content 直接写 finalContent
                return { ...message, content: finalContent };
              }
              return {
                ...message,
                replies: editMessage(message.replies),
              };
            });
          };

          return { ...thread, messages: editMessage(thread.messages) };
        })
      );
      storage.set("threads", threads);
      setEditingMessage(null);
      setEditingContent("");

      // 发送给后端
      try {
        console.log("[confirmEditingMessage] sending PATCH /api/messages/", messageId);
        const res = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: finalContent, // 这时后端就能拿到一个 ContentPart[] 
          }),
        });
        console.log("[confirmEditingMessage] response status =", res.status);
        if (!res.ok) {
          throw new Error("Failed to update message content");
        }
        console.log("Message content updated in DB!");
      } catch (e) {
        console.error("confirmEditingMessage error:", e);
      }
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
  }, []);

  // Debounce saveThreads to avoid frequent saves
  const debouncedSaveThreads = useMemo(
    () => debounce(saveThreads, 2000),
    [saveThreads]
  );
  async function syncWelcomeThreadToBackend(thread: Thread) {
    // 这里 thread 就是 {id, title, isPinned, updatedAt, messages: [...]}
    // messages 里还有 replies，需要在后端处理好“递归插入”或简单 forEach

    const res = await fetch("/api/threads/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread }),
    });
    if (!res.ok) {
      throw new Error(`syncWelcomeThread failed => status = ${res.status}`);
    }
    const data = await res.json();
    return data;
  }

  const addThread = useCallback(async () => {
    // 1) 先生成前端 ID
    const frontEndId = uuidv4();
    console.log("[addThread] start create thread => frontEndId =", frontEndId);

    // 2) 创建一个乐观的 thread（如果你想插入一个“空白”或“占位”的对象）
    //    或者也可以只等后端成功后再来 setThreads
    const optimisticThread: Thread = {
      id: frontEndId,
      title: "New Thread",
      isPinned: false,

      messages: [],
    };
    // 先插入到前端
    setThreads((prev) => [...prev, optimisticThread]);

    try {
      // 3) 发起后端请求，写入数据库
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: frontEndId, title: "" }),
      });
      if (!res.ok) {
        throw new Error("Failed to create thread");
      }

      const data = await res.json();
      console.log("[addThread] server returned data =", data);

      // 4) 这里你可以“更新” 或 “替换” 前端状态中的这个 thread，
      //    也可直接把后端返回的“新 thread”再合并/覆盖一次
      const returnedThread: Thread = data.thread;
      setThreads((prev) =>
        prev.map((t) => (t.id === frontEndId ? returnedThread : t))
      );

      // 5) 如果需要从后端再 fetch 额外数据(例如它的 messages等)，可以在这儿 fetch
      //    fetchSingleThread(returnedThread.id);

      // 6) 最后再选中它
      setCurrentThread(returnedThread.id);
      setEditingThreadTitle(returnedThread.id);
      setOriginalThreadTitle(returnedThread.title || "");
      setNewThreadId(returnedThread.id);

      console.log("[addThread] success => newThreadId =", returnedThread.id);
    } catch (error) {
      console.error("[addThread] error =>", error);

      // 如果后端失败 => 可考虑回滚
      setThreads((prev) => prev.filter((t) => t.id !== frontEndId));
    }
  }, [
    setThreads,
    setCurrentThread,
    setEditingThreadTitle,
    setOriginalThreadTitle,
    setNewThreadId
  ]);

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
      const realId = newMessageId || uuidv4();
      // 1) 先在前端插入临时消息
      console.log("[addMessage] about to add:", {
        threadId,
        parentId,
        publisher,
        realId,
        newMessageId,
        content,
        modelDetails,
      });
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;

          const newMessage: Message = {
            id: newMessageId || realId,
            content,
            publisher,

            // 如果是用户，就带上本地用户名；如果是 AI，就带上 model 信息
            userName: publisher === "user" ? (username ?? undefined) : undefined,
            modelId: publisher === "ai" ? modelDetails?.id : undefined,
            modelConfig:
              publisher === "ai"
                ? {
                  id: modelDetails?.id,
                  name: modelDetails?.name,
                  baseModel: modelDetails?.baseModel,
                  systemPrompt: modelDetails?.systemPrompt,
                  parameters: {
                    ...modelDetails?.parameters,
                  },
                }
                : undefined,
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

          console.log("[addMessage] sending POST /api/messages with id=", realId);
          const response = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: realId,
              threadId,
              parentId,
              publisher,
              content,
              modelConfig:
                publisher === "ai"
                  ? {
                    id: modelDetails?.id,
                    name: modelDetails?.name,
                    baseModel: modelDetails?.baseModel,
                    systemPrompt: modelDetails?.systemPrompt,
                    parameters: modelDetails?.parameters,
                  }
                  : null,
            }),
          });
          console.log("[addMessage] got response status =", response.status);
          if (!response.ok) {
            throw new Error("Failed to create message");
          }

        } catch (error) {
          console.error("addMessage failed:", error);
          // 如果想回滚插入的临时消息，可在这里做 setThreads() 移除 tempId
        }
      })();
    },
    [setThreads, setSelectedMessages, currentThread, username]
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

  const startEditingMessage = useCallback(
    (message: Message) => {
      setEditingMessage(message.id);

      if (Array.isArray(message.content)) {
        // 只把 text 的部分拼起来
        // （也可以只取第一个 textPart，或把它们加上分隔符拼一起）
        const textParts = message.content
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n\n");

        setEditingContent(textParts || "");
      } else if (typeof message.content === "string") {
        // 老的情况，直接把 string 显示
        setEditingContent(message.content);
      } else {
        // 如果根本没内容
        setEditingContent("");
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
    (threadId: string, parentId: string | null, publisher: "user" | "ai" = "user") => {
      const newId = uuidv4();

      addMessage(threadId, parentId, "", publisher, newId);

      startEditingMessage({
        id: newId,
        content: "",
        publisher: publisher,
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
    async (threadId: string, messageId: string, deleteOption: boolean | 'clear') => {
      const oldThreads = structuredClone(threads);
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
      try {
        const res = await fetch(`/api/messages/${messageId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            deleteOption,
          }),
        });
        if (!res.ok) {
          throw new Error(`[deleteMessage] fail => status = ${res.status}`);
        }
        // 如果后端成功，就到此结束
      } catch (err) {
        console.error("[deleteMessage] error =>", err);
        // 4) 出错了 => 回滚
        setThreads(oldThreads);
      }
    },
    [setSelectedMessages, findMessageAndParents, threads, currentThread, setThreads]
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
            return [...acc, { ...message, replies: removeEmptyMessage(message.replies) }];
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
      //导致数据库模型参数混乱的主要原因。
      // Find the corresponding model in availableModels to get the max_output
      const selectedModel = availableModels.find(
        (model) => model.id === modelId
      );
      if (selectedModel && selectedModel.parameters?.max_output) {
        data.max_output = selectedModel.parameters.max_output;
      }
      console.log("fetch model parameter: ", data);
      return data;
    } catch (error) {
      console.error("Error fetching model parameters:", error);
      throw error;
    }
  };

  const saveModelChanges = useCallback(async () => {
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

      try {
        // 3) 发起对后端的 PATCH 请求
        const res = await fetch(`/api/models/${editingModel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updatedModel.name,
            baseModel: updatedModel.baseModel,
            systemPrompt: updatedModel.systemPrompt,
            parameters: updatedModel.parameters,
          }),
        });
        if (!res.ok) {
          throw new Error(`Failed to update model ${editingModel.id}`);
        }
      } catch (err) {
        console.error("[saveModelChanges] error =>", err);

      }
      setEditingModel(null);
    }
  }, [editingModel, setEditingModel, setModels]);

  const deleteModel = useCallback(
    async (id: string) => {
      // 1) 先把当前的前端状态记录下来，以便失败后回滚
      const oldModels = structuredClone(models);
      const oldSelected = [...selectedModels];

      // 2) 前端先行移除
      setModels((prev) => prev.filter((model) => model.id !== id));
      if (selectedModels.includes(id)) {
        // 先把 id 从 selectedModels 里移除
        const newSelected = selectedModels.filter((mid) => mid !== id);

        // 如果还有别的 model，就选一下别的
        // 这里示例：如果原本 models.length > 1，就选第一个没删的
        /*   const remainingModels = oldModels.filter((m) => m.id !== id);
          if (remainingModels.length > 0) {
            newSelected.push(remainingModels[0].id);
          }
   */
        setSelectedModels(newSelected);
      }
      // 3) 发起后端请求
      try {
        const res = await fetch(`/api/models/${id}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error(`Server fail, status = ${res.status}`);
        }
        // 如果删除成功，这里什么都不用做
        console.log(`[deleteModel] success => removed from backend`);
      } catch (err) {
        console.error(`[deleteModel] error =>`, err);
        // 4) 若后端失败，前端回滚
        setModels(oldModels);
        setSelectedModels(oldSelected);
      }
    },
    [models, selectedModels, setModels, setSelectedModels]
  );
  // 假设在外层你已导入/定义:
  //   import { v4 as uuidv4 } from 'uuid';
  //   interface Model { ... } // your Model interface

  const addNewModel = useCallback(async (modelToClone?: Model) => {
    const newId = uuidv4();
    const newModel: Model = modelToClone ? {
      ...modelToClone,
      id: newId,
      name: `${modelToClone.name}`
    } : {
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

    // 1) 先“乐观”地插入到前端，并让用户可以编辑
    setModels((prev) => [...prev, newModel]);


    try {
      // 2) 调用后端插入接口（只插 1 条）
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel }),
      });

      if (!response.ok) {
        throw new Error("Failed to create new model");
      }

      // 3) 后端创建成功 -> 不用做额外操作
      const data = await response.json();
      setEditingModel(newModel);
      console.log("[addNewModel] server created =>", data.model);
      // 如果后端对 newModel 有做二次处理（比如 ID 重写），
      // 也可在这里同步回前端:
      // setModels(prev => prev.map(m => m.id === newId ? {...m, id: data.model.id} : m));

    } catch (err) {
      console.error("[addNewModel] error =>", err);

      // 4) 如果后端失败 => 回滚
      setModels((prev) => prev.filter((m) => m.id !== newId));
      setEditingModel(null);
      // 根据需要，你也可以给用户弹个报错提示
    }
  }, [setModels, setEditingModel]);

  const toggleThreadPin = useCallback(async (threadId: string) => {
    console.log("[toggleThreadPin] clicked => threadId=", threadId);

    setThreads((prev) => {
      console.log("[toggleThreadPin] before =>", prev);
      return prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const pinnedNow = !thread.isPinned;
        console.log("[toggleThreadPin] flipping pinned =>", pinnedNow);
        // 一定要...thread
        return { ...thread, isPinned: pinnedNow };
      });
    });

    try {
      // pinned => call patch
      const currentObj = threads.find((t) => t.id === threadId);
      const newPinnedValue = currentObj ? !currentObj.isPinned : true;
      console.log("[toggleThreadPin] about to PATCH => pinned=", newPinnedValue);

      const res = await fetch("/api/membership/insertpin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          pinned: newPinnedValue,
        }),
      });
      if (!res.ok) {
        throw new Error("[toggleThreadPin] server fail, status=" + res.status);
      }
      console.log("[toggleThreadPin] success");
    } catch (err) {
      console.error("[toggleThreadPin] error =>", err);
    }
  }, [threads, setThreads]);


  // ------------------------------------------------
  const deleteThread = useCallback(async (threadId: string) => {
    console.log("[deleteThread] clicked => threadId=", threadId);
    const oldThreads = threads;
    const oldCurrent = currentThread;

    console.log("[deleteThread] oldThreads=", oldThreads);

    // 先行移除
    setThreads((prev) => {
      console.log("[deleteThread] setThreads old =>", prev);
      const newList = prev.filter((t) => t.id !== threadId);
      storage.set("threads", newList);
      console.log("[deleteThread] newList =>", newList);
      return newList;
    });

    if (currentThread === threadId) {
      console.log("[deleteThread] removing currentThread => setCurrentThread(null)");
      setCurrentThread(null);
    }

    try {
      console.log("[deleteThread] fetch => /api/threads/", threadId);
      const res = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`[deleteThread] server fail, status=${res.status}`);
      }
      console.log("[deleteThread] success => server removed");
    } catch (err) {
      console.error("[deleteThread] fail => revert local state, err=", err);
      // 回滚
      setThreads(oldThreads);
      setCurrentThread(oldCurrent);
      storage.set("threads", oldThreads);
    }
  }, [threads, currentThread, setThreads, setCurrentThread]);


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
      const newId = uuidv4();

      const messageToPaste = clipboardMessage?.message || {
        id: newId,
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

      (async () => {
        try {
          // 只在有 clipboardMessage 情况下发请求，
          // 或者你也可以写成“无论如何都发”，看需求
          if (clipboardMessage) {
            const response = await fetch("/api/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: newId,
                threadId: threadId,
                parentId: parentId,
                publisher: messageToPaste.publisher,
                content: messageToPaste.content,
                modelConfig: messageToPaste.modelConfig ?? null,
              }),
            });
            if (!response.ok) {
              throw new Error("Failed to create pasted message in DB");
            }
            console.log("[pasteMessage] success => server stored new message", newId);
          }
        } catch (err) {
          console.error("[pasteMessage] error => server store fail:", err);
          // 如需回滚可在此执行 setThreads(...) 删除临时消息
        }
      })();
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
  async function refreshUsage(userKey: string) {
    if (!userKey) return;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userKey}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Key usage fetch failed. HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeyInfo(data); // 更新 state => SettingsPanel 显示新余额
    } catch (err) {
      console.error("refreshUsage error:", err);
      setKeyInfo(null);
    }
  }
  const abortControllersRef = useRef<Record<string, AbortController | null>>({});

  // Generate AI reply
  const generateAIReply = useCallback(
    async (threadId: string, messageId: string, count: number = 1) => {
      const userKey = storage.get("openrouter_api_key") || "";
      if (isGenerating[messageId]) {
        console.log("第二次点击 => Stop for messageId=", messageId);
        const controller = abortControllersRef.current[messageId];
        if (controller) {
          controller.abort(); // 真正中断请求
        }
        abortControllersRef.current[messageId] = null;
        setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
        return;
      }
 
      const thread = threads.find((t: { id: string }) => t.id === threadId);
      if (!thread) return;

      const message = findMessageById(thread.messages, messageId);
      if (!message) return;
      const selectedModelIds = selectedModels;
      if (selectedModelIds.length === 0) {
         alert("No model selected. Please select a model in Models tab to proceed.");
         setActiveTab("models");
         return;
       } 

      try {
     

        for (let i = 0; i < count; i++) {
          const promises = selectedModelIds.map(async (modelId) => {
            const model = models.find((m) => m.id === modelId);
            if (!model) return;

            if (!isSignedIn && !model.baseModel.endsWith(":free")) {
              alert(`Sign in to use ${model.baseModel}`);
              return;
            }
            const newId = uuidv4();

            // Pass the model details when creating the message
            addMessage(threadId, messageId, "", "ai", newId, model);
            setIsGenerating((prev) => ({ ...prev, [newId]: true }));
            const messageAbortController = new AbortController();
            // 存到全局字典
            abortControllersRef.current[newId] = messageAbortController;
            let fullResponse = "";
            try {
              const enabledTools = (model.parameters?.tool_choice !== "none" && model.parameters?.tool_choice !== undefined
                ? model.parameters?.tools ?? []
                : []) as Tool[];
              let finalContent: string;
              if (typeof message.content === "string") {
                finalContent = message.content;
              } else if (Array.isArray(message.content)) {
                // Combine all text parts into a single string
                finalContent = message.content
                  .filter(part => part.type === "text")
                  .map(part => part.text)
                  .join("\n");
              } else {
                finalContent = "";
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
                          updateMessageContent(threadId, newId, fullResponse);
                        }
                      } catch (error) {
                        console.error("Error parsing chunk:", error);
                      }
                    }
                  }
                },
                userKey,
                messageAbortController
              );
            } finally {
              setIsGenerating((prev) => ({ ...prev, [newId]: false }));
              abortControllersRef.current[newId] = null;
              if (fullResponse.trim()) {
                try {
                  const patchRes = await fetch(`/api/messages/${newId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      content: [
                        {
                          type: "text",
                          text: fullResponse.trim(),
                        },
                      ],
                    }),
                  });
                  if (!patchRes.ok) {
                    throw new Error("Failed to update AI message in DB");
                  }
                } catch (err) {
                  console.error("Patch AI message fail:", err);
                }
              }
              if (userKey) {
                await refreshUsage(userKey);
              } else {
                await reloadUserProfile;  // 用后端ENV key => reloadProfile
              }
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
      isGenerating,
      isSignedIn
    ]
  );

  function createWelcomeThread(): Thread {
    const threadId = uuidv4();
    const messageId = uuidv4();
    const childMessageId = uuidv4();

    return {
      id: threadId,
      title: "Welcome to AIDE",
      isPinned: false,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: messageId,
          content: [
            {
              type: "text",
              text: `# 👋 Welcome to AIDE!

Here are some tips to get started (click to expand):

- **Create new threads** using the + button
- **Reply to messages** using the reply button or 'R' key
- **Generate AI responses** using the sparkle button or 'G' key
- **Navigate through parent/child messages** using arrow keys
- **Copy messages** using the copy button or 'C' key
- **Delete messages** using the delete button or 'D' key
- **Configure AI models** in the Models tab
- **Use keyboard shortcuts** (press '?' to view all)

Feel free to delete this thread and create your own!`}
          ],
          publisher: "ai",
          replies: [
            {
              id: childMessageId,
              content: [
                {
                  type: "text",
                  text: "This is a child message. You can navigate to parent messages using the 'Up' arrow key and to child messages using the 'Down' arrow key."
                }
              ],
              publisher: "ai",
              replies: [],
              isCollapsed: false,
              userCollapsed: false
            }
          ],
          isCollapsed: false,
          userCollapsed: false
        }
      ]
    };
  }

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        const response = await fetch(`/api/threads`, {
          method: "GET",
        });

        if (response.ok) {
          const data = await response.json();

          if (data.threads?.length > 0) {
            setThreads(data.threads);
            storage.set("threads", data.threads);
          } else {
            const localThreads = storage.get("threads") || [];

            if (localThreads.length > 0) {
              // 本地已有线程 => 不再创建欢迎贴，直接用本地
              setThreads(localThreads);
              setCurrentThread(localThreads[0].id);
            } else {
              // 本地也空 => 真的需要创建欢迎贴
              const welcomeThread = createWelcomeThread();
              setThreads([welcomeThread]);
              storage.set("threads", [welcomeThread]);
              setCurrentThread(welcomeThread.id);

              if (isSignedIn) {
                try {
                  // 同步
                  await syncWelcomeThreadToBackend(welcomeThread);
                  console.log("Welcome thread successfully synced to backend!");
                } catch (err) {
                  console.error("Failed to sync welcome thread =>", err);
                }
              }

            }
          }

        } else {
          // API error - create welcome thread locally
          const welcomeThread = createWelcomeThread();
          setThreads([welcomeThread]);
          setCurrentThread(welcomeThread.id);
        }
      } catch (error) {
        console.error("Load failed:", error);
        // Network/other error - create welcome thread locally
        const welcomeThread = createWelcomeThread();
        setThreads([welcomeThread]);
        setCurrentThread(welcomeThread.id);
        storage.set("threads", [welcomeThread]);
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

  function createDefaultModel(): Model {
    return {
      id: uuidv4(),
      name: "Default",
      baseModel: "openai/gpt-4o-mini",
      systemPrompt: "Answer concisely.",
      parameters: {
        temperature: 0,
        top_p: 1,
        max_tokens: 1000,
      },
    };
  }

  // 在你的 useEffect 里，检测如果后端没有模型，就创建默认模型并同步到后端：
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch("/api/models", { method: "GET" });
        if (!response.ok) {
          console.error("Failed to load models from backend.");
          // 如果加载失败，也给一个默认模型
          const defaultM = createDefaultModel();
          setModels([defaultM]);
          setModelsLoaded(true);
          return;
        }

        const data = await response.json();
        let loadedModels = data.models || [];

        // 如果后端没有任何模型，就创建一个默认模型
        if (loadedModels.length === 0) {
          const defaultM = createDefaultModel();
          // 先放进前端 state
          loadedModels = [defaultM];
          // 然后立刻 POST 到后端，确保后续 patch 不会 404
          try {
            const res = await fetch("/api/models", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: defaultM }),
            });
            if (!res.ok) {
              throw new Error("Failed to create default model in DB");
            }
            const postData = await res.json();
            // 如果后端对这个 model 做了二次处理/重写了 id，这里可再次 setModels
            if (postData.model && postData.model.id !== defaultM.id) {
              // 同步更新到前端 state
              defaultM.id = postData.model.id;
              loadedModels = [defaultM];
            }
          } catch (err) {
            console.error("[loadModels] failed to create default model =>", err);
          }
        }

        setModels(loadedModels);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading models:", error);
        // 兜底：如果你想在这里也放个默认模型
        const defaultM = createDefaultModel();
        setModels([defaultM]);
        setModelsLoaded(true);
      }
    };

    loadModels();
  }, [setModels, setModelsLoaded, setSelectedModels]);

  // 如果你还要获取 openrouter.ai 的可选模型，可依旧用你的 fetchAvailableModels：
  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  /*  // fetch available models
   useEffect(() => {
     const saveModels = async () => {
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
  */
  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  useEffect(() => {
    if (!currentThread) {
      // 如果没有选中任何 thread，就直接 return
      return;
    }

    // 如果根本不存在 selectedMessages[currentThread]，也无须展开
    if (!selectedMessages[currentThread]) {
      return;
    }

    setThreads((prevThreads) =>
      prevThreads.map((thread) => {
        if (thread.id !== currentThread) {
          return thread;
        }

        // 防御：如果 thread.messages 不是数组，则打印一下看看
        if (!Array.isArray(thread.messages)) {
          console.warn(
            "[collapseDeepChildren] thread.messages 不是数组，无法迭代，thread=",
            thread
          );
          return thread;
          // 或者 return { ...thread, messages: [] }; 视实际需求决定
        }

        // 调试：先输出一下 messages 长啥样
        console.log(
          "[collapseDeepChildren] currentThread messages =",
          thread.messages
        );

        const findSelectedMessageBranch = (
          messages: Message[],
          depth: number = 0
        ): [number, Message[]] => {
          for (const msg of messages) {
            if (msg.id === selectedMessages[currentThread]) {
              return [depth, [msg]];
            }
            const [foundDepth, branch] = findSelectedMessageBranch(
              msg.replies,
              depth + 1
            );
            if (foundDepth !== -1) {
              return [foundDepth, [msg, ...branch]];
            }
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
      })
    );
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
    <div className="h-screen flex flex-col md:flex-row p-2 pb-0 md:pr-0 text-ellipsis ">
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
              setModels={setModels}
            />
          </TabsContent>
          <TabsContent
            value="settings"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <SettingsPanel
        keyInfo={keyInfo}
        refreshUsage={refreshUsage}
      />
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
        <ResizablePanelGroup direction="horizontal" className="grow">
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
                className="grow overflow-y-clip"
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
              <TabsContent value="models" className="grow overflow-y-clip">
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
              <TabsContent value="tools" className="grow overflow-y-clip">
                <ToolManager
                  tools={tools}
                  setTools={setTools}
                  isLoading={toolsLoading}
                  error={toolsError}
                  availableTools={availableTools}
                  setAvailableTools={setAvailableTools}
                  setModels={setModels}
                />
              </TabsContent>
              <TabsContent value="settings" className="grow overflow-y-clip">
              <SettingsPanel
        keyInfo={keyInfo}
        refreshUsage={refreshUsage}
      />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle withHandle hitAreaMargins={{ coarse: 16, fine: 8 }} className="mx-2 w-0 px-px bg-linear-to-b from-background via-transparent to-background" />
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