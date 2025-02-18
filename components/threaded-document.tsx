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
import DraggableDialog from "@/components/ui/draggable-dialog"
import { ToolManager } from "./tool/tool-manager";
import { generateAIResponse } from "@/components/utils/api";
import { Thread, Message, Model, ModelParameters, Tool, ContentPart, KeyInfo } from "./types";
import { useModels } from "./hooks/use-models";
import { useThreads } from "./hooks/use-threads";
import { useMessages } from "./hooks/use-messages";
import { useUser, useClerk, useSession } from "@clerk/nextjs";
import { SettingsPanel } from "./settings/settings-panel"
import { useTools } from "./hooks/use-tools";
import { useUserProfile } from "./hooks/use-userprofile";
import { AlignJustify, MessageSquare, Sparkle, Settings, Package } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useClearStorageOnExit } from "./useClearStorageOnExit";
import { fetchMessageLatest } from "@/lib/frontapi/messageApi";
import { handleSelectMessage } from "./utils/handleSelectMessage";
import { useToast } from "./hooks/use-toast";
import { useMessagesMutation } from '@/lib/hooks/use-messages-mutation';

export default function ThreadedDocument() {
  useClearStorageOnExit();
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const { isSignedIn } = useUser();
  const { username, reloadUserProfile } = useUserProfile();
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
  const { toast } = useToast()
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

  const [editorOpen, setEditorOpen] = useState(false);
  const [currentToolId, setCurrentToolId] = useState<string>("");
  // 3) 控制"脚本编辑"弹窗
  const [toolScripts, setToolScripts] = useState<{ [id: string]: string }>({});
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  // 当前要编辑哪个工具的脚本
  const [scriptDialogTool, setScriptDialogTool] = useState<Tool | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Worker
  const workerRef = useRef<Worker | null>(null);

  const { addMessage, updateMessage, deleteMessage, copyMessage, pasteMessage } = useMessagesMutation();

  useEffect(() => {
    // 页面加载时，先创建 Worker
    const w = new Worker("/scriptWorker.js");
    w.onmessage = (e) => {
      const { result } = e.data;
      alert("脚本执行结果: " + result);
      console.log("脚本执行完成 =>", result);
    };
    workerRef.current = w;

    // 卸载时销毁
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);
  function handleEditScript(toolId: string) {
    setCurrentToolId(toolId);
    setEditorOpen(true);
  }

  // 2) 获取初始脚本 (localStorage)
  function getInitialScript(toolId: string) {
    const saved = window.localStorage.getItem(`script_${toolId}`);
    return saved || ""; // 如果没有就返回空
  }

  // 3) 保存脚本时
  function handleSaveScript(toolId: string, script: string) {
    // 存入 localStorage
    window.localStorage.setItem(`script_${toolId}`, script);
    console.log("脚本已保存 =>", { toolId, script });
  }

  // ---------- 4) 自动执行脚本 ----------
  async function runScriptForTool(toolId: string) {
    if (!workerRef.current) {
      console.error("Worker not ready");
      return;
    }
    const code = window.localStorage.getItem(`script_${toolId}`);
    if (!code) {
      alert(`没有在 localStorage 找到脚本 => script_${toolId}`);
      return;
    }
    // 发送到 Worker
    workerRef.current.postMessage({ code });
  }

  /**
   * 真正从后端拉取 messages 的函数
   * 拉取后更新 setThreads，并写进 localStorage
   */
  const fetchSingleThread = useCallback(async (threadId: string) => {
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
  }, [setThreads]);

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
  }, [currentThread, fetchSingleThread, threads]);

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

  const confirmEditingMessage = useCallback(
    async (threadId: string, messageId: string) => {
      console.log("[confirmEditingMessage] start, messageId =", messageId);

      let finalContent: ContentPart[];

      try {
        // Parse the content
        const maybeJson = JSON.parse(editingContent);
        if (Array.isArray(maybeJson)) {
          finalContent = maybeJson;
        } else {
          finalContent = [
            {
              type: "text",
              text: editingContent.trim(),
            },
          ];
        }
      } catch (err) {
        finalContent = [
          {
            type: "text",
            text: editingContent.trim(),
          },
        ];
      }

      try {
        // Use updateMessage mutation with all required parameters
        await updateMessage.mutateAsync({
          messageId,
          threadId,
          content: finalContent,
          publisher: "user"
        });

        // Clear editing state
        setEditingMessage(null);
        setEditingContent("");
      } catch (err) {
        console.error("[confirmEditingMessage] error =>", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to update message",
          variant: "destructive"
        });
      }
    },
    [editingContent, setEditingContent, setEditingMessage, updateMessage, toast]
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
      const savePromises = threadsToSave.map((thread: Thread) =>
        fetch(`/api/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: thread.id, thread }),
        })
      );
      await Promise.all(savePromises);
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
    // messages 里还有 replies，需要在后端处理好"递归插入"或简单 forEach

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
  /*  const startEditingMessage = useCallback(
     async (msg: Message) => {
       try {
         const lockedSuccessfully = await lockMessage(msg.id);
         if (!lockedSuccessfully) {
           toast({
             title: "Message Locked",
             description: "This message is currently being edited by another user",
             variant: "destructive"
           });
           return;
         }
 
         setEditingMessage(msg.id);
         setEditingContent(extractTextFromContent(msg.content));
       } catch (err: any) {
         toast({
           title: "Error",
           description: err.message || "Failed to start editing message",
           variant: "destructive"
         });
       }
     },
     [setEditingMessage, setEditingContent, toast]
   );
  */
  // 把 message.content => string
  function extractTextFromContent(content: string | ContentPart[]) {
    if (typeof content === "string") {
      return content;
    }

    // 合并第一个 textPart
    const textPart = content.find(p => p.type === "text");
    return textPart?.text || "";
  }
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
    async (threadId: string, parentId: string | null, publisher: "user" | "ai" = "user") => {
      const newId = uuidv4();

      try {
        // First create the message in the database
        await addMessage.mutateAsync({
          id: newId,
          threadId,
          parentId,
          publisher,
          content: "",
        });

        // Then start editing it
        startEditingMessage({
          id: newId,
          content: "",
          publisher,
          replies: [],
          isCollapsed: false,
          userCollapsed: false,
        });

        // Scroll to the new message
        const newMessageElement = document.getElementById(
          `message-${newId}`
        );
        if (newMessageElement) {
          newMessageElement.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }

        // Select the new message
        setSelectedMessages(prev => ({
          ...prev,
          [threadId]: newId
        }));
      } catch (err) {
        console.error("[addEmptyReply] error =>", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to create new message",
          variant: "destructive"
        });
      }
    },
    [addMessage, startEditingMessage, setSelectedMessages, toast]
  );

  // Delete a message
  const handleDeleteMessage = useCallback(
    async (threadId: string, messageId: string, deleteOption: boolean | 'clear') => {
      try {
        await deleteMessage.mutateAsync({
          messageId,
          threadId,
          deleteOption
        });
      } catch (err) {
        console.error("[deleteMessage] error =>", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to delete message",
          variant: "destructive"
        });
      }
    },
    [deleteMessage, toast]
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
    async (threadId: string, messageId: string, operation: "copy" | "cut") => {
      try {
        const result = await copyMessage.mutateAsync({ threadId, messageId, operation });

        // Copy content to clipboard
        const content = typeof result.message.content === "string"
          ? result.message.content
          : JSON.stringify(result.message.content);
        navigator.clipboard.writeText(content);

        // Update clipboard state
        setClipboardMessage({
          message: result.message,
          operation,
          sourceThreadId: threadId,
          originalMessageId: messageId,
        });

        clearGlowingMessages();
        addGlowingMessage(messageId);
      } catch (error) {
        console.error("Failed to copy/cut message:", error);
        toast({
          title: "Error",
          description: "Failed to copy/cut message",
          variant: "destructive"
        });
      }
    },
    [copyMessage, setClipboardMessage, clearGlowingMessages, addGlowingMessage, toast]
  );

  const cancelEditingMessage = useCallback(() => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        const removeEmptyMessage = (messages: Message[]): Message[] => {
          if (!messages) return [];
          return messages.reduce((acc: Message[], message) => {
            if (message.id === editingMessage && (typeof message.content === "string"
              ? !message.content.trim()
              : (Array.isArray(message.content) && message.content.length === 0))) {
              // If message is empty
              handleDeleteMessage(thread.id, message.id, false);
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
    handleDeleteMessage,
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

    // 1) 先"乐观"地插入到前端，并让用户可以编辑
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

  const toggleThreadPin = useCallback((threadId: string) => {
    // This is now just a callback for any side effects needed when a thread is pinned/unpinned
    // The actual pin toggling is handled by React Query mutation in ThreadList
    setActiveTab("threads");
  }, [setActiveTab]);


  // ------------------------------------------------
  const deleteThread = useCallback((threadId: string) => {
    // This is now just a callback for any side effects needed when a thread is deleted
    // The actual thread deletion is handled by React Query mutation in ThreadList
    setActiveTab("threads");

    // Clear any selected messages for this thread
    setSelectedMessages(prev => {
      const newState = { ...prev };
      delete newState[threadId];
      return newState;
    });
  }, [setActiveTab, setSelectedMessages]);


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

  const handlePasteMessage = useCallback(
    async (threadId: string, parentId: string | null) => {
      if (!clipboardMessage) {
        // Handle pasting from system clipboard
        try {
          const text = await navigator.clipboard.readText();
          await addMessage.mutateAsync({
            threadId,
            parentId,
            publisher: "user",
            content: text
          });
        } catch (error) {
          console.error("Failed to paste from clipboard:", error);
          toast({
            title: "Error",
            description: "Failed to paste from clipboard",
            variant: "destructive"
          });
        }
        return;
      }

      try {
        // Prevent pasting on the original message or its children
        if (clipboardMessage.operation === "cut" && clipboardMessage.originalMessageId) {
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

          if (originalMessage && (parentId === clipboardMessage.originalMessageId || isDescendant(originalMessage))) {
            toast({
              title: "Invalid Operation",
              description: "Cut and paste on children is not allowed",
              variant: "destructive"
            });
            return;
          }
        }

        await pasteMessage.mutateAsync({
          threadId,
          parentId,
          clipboardMessage
        });

        if (currentThread) {
          setSelectedMessages(prev => ({
            ...prev,
            [currentThread]: clipboardMessage.message.id
          }));
        }

        if (clipboardMessage.operation === "cut" || clipboardMessage.operation === "copy") {
          setClipboardMessage(null);
          clearGlowingMessages();
        }
      } catch (error) {
        console.error("Failed to paste message:", error);
        toast({
          title: "Error",
          description: "Failed to paste message",
          variant: "destructive"
        });
      }
    },
    [
      clipboardMessage,
      pasteMessage,
      addMessage,
      currentThread,
      findMessageById,
      threads,
      setSelectedMessages,
      setClipboardMessage,
      clearGlowingMessages,
      toast
    ]
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
        console.log("Second click => Stop for messageId=", messageId);
        const controller = abortControllersRef.current[messageId];
        if (controller) {
          controller.abort();
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
        if (models.length > 0) {
          toast({
            title: "No Model Selected",
            description: "First available model has been automatically selected.",
          });
          setActiveTab("models");
          const firstModelId = models[0].id;
          selectedModels.push(firstModelId);
        } else {
          toast({
            title: "No Model Selected",
            description: "Please select a model in Models tab to proceed.",
            variant: "destructive"
          });
          setActiveTab("models");
          return;
        }
      }

      try {
        for (let i = 0; i < count; i++) {
          const promises = selectedModelIds.map(async (modelId) => {
            const model = models.find((m) => m.id === modelId);
            if (!model) return;

            if (!isSignedIn && !model.baseModel.endsWith(":free")) {
              toast({
                title: "Authentication Required",
                description: `Sign in to use ${model.baseModel}`,
                variant: "destructive"
              });
              return;
            }

            const messageAbortController = new AbortController();
            abortControllersRef.current[messageId] = messageAbortController;

            setIsGenerating((prev) => ({ ...prev, [messageId]: true }));

            try {
              await addMessage.mutateAsync({
                threadId,
                parentId: messageId,
                publisher: "ai",
                content: "",
                modelConfig: {
                  id: model.id,
                  name: model.name,
                  baseModel: model.baseModel,
                  systemPrompt: model.systemPrompt,
                  parameters: model.parameters,
                },
                generateAIResponse: {
                  model,
                  userKey,
                  abortController: messageAbortController,
                  onChunk: (chunk) => {
                    updateMessageContent(threadId, messageId, chunk);
                  }
                }
              });

              if (userKey) {
                await refreshUsage(userKey);
              } else {
                await reloadUserProfile();
              }
            } catch (error) {
              console.error("Failed to generate AI response:", error);
              toast({
                title: "Generation Failed",
                description: error instanceof Error ? error.message : "Unknown error occurred",
                variant: "destructive"
              });
            } finally {
              setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
              abortControllersRef.current[messageId] = null;
            }
          });
          await Promise.all(promises);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Generation aborted
        } else {
          console.error("Failed to generate AI response:", error);
        }
      }
    },
    [
      toast,
      threads,
      models,
      selectedModels,
      findMessageById,
      updateMessageContent,
      isGenerating,
      isSignedIn,
      reloadUserProfile,
      refreshUsage,
      addMessage,
      setActiveTab
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
      role: "OWNER",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: messageId,
          content: [
            {
              type: "text",
              text: `# 👋 Welcome to AIDE!

Core concepts (click to expand):

- **Create new threads** in the Threads tab
- **Reply to messages** under each thread
- **Generate AI responses** using Enter key (Ctrl/Cmd+Enter for multi-runs)
- **Configure Model Parameters and Tools** in the Models/Tools tab
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
                  text: "This is a child message. You can navigate to parent messages using the 'Left' arrow key and to child messages using the 'Right' arrow key."
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
  }, [setThreads, setCurrentThread, isSignedIn]);

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
            handlePasteMessage(currentThread, selectedMessage || null);
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
              handleDeleteMessage(currentThread, selectedMessage, true);
            } else if (event.altKey) {
              handleDeleteMessage(currentThread, selectedMessage, 'clear');
            } else {
              handleDeleteMessage(currentThread, selectedMessage, false);
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
    handleDeleteMessage,
    findMessageById,
    confirmEditingMessage,
    cancelEditingMessage,
    saveModelChanges,
    clipboardMessage,
    copyOrCutMessage,
    findMessageAndParents,
    getSiblings,
    handlePasteMessage,
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
              currentThread={currentThread}
              setCurrentThread={setCurrentThread}
              startEditingThreadTitle={startEditingThreadTitle}
              confirmEditThreadTitle={confirmEditThreadTitle}
              cancelEditThreadTitle={cancelEditThreadTitle}
              toggleThreadPin={toggleThreadPin}
              deleteThread={deleteThread}
              editingThreadTitle={editingThreadTitle}
              setSelectedMessages={setSelectedMessages}
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
              pasteMessage={handlePasteMessage}
              deleteMessage={handleDeleteMessage}
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
                  setSelectedMessages={setSelectedMessages}
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
                  setModels={setModels}

                />
              </TabsContent>
              <TabsContent value="settings" className="flex-grow overflow-y-clip">
                <SettingsPanel
                  keyInfo={keyInfo}
                  refreshUsage={refreshUsage}
                />
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
                pasteMessage={handlePasteMessage}
                deleteMessage={handleDeleteMessage}
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