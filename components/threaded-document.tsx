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
import { Thread, Message, Model, ModelParameters, Tool, ContentPart, KeyInfo } from "./types";
import { useModels } from "../lib/hooks/use-models";
import { useThreads } from "../lib/hooks/use-threads";
import { useMessages } from "../lib/hooks/use-messages";
import { useUser } from "@clerk/nextjs";
import { SettingsPanel } from "./settings/settings-panel"
import { useTools } from "../lib/hooks/use-tools";
import { useUserProfile } from "../lib/hooks/use-userprofile";
import { AlignJustify, MessageSquare, Sparkle, Settings, Package } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useClearStorageOnExit } from "./useClearStorageOnExit";
import { useToast } from "../lib/hooks/use-toast";
import { useMessagesMutation } from '@/lib/hooks/use-messages-mutation';
import { useThreadData } from '@/lib/hooks/use-thread-data';
import { useMessageUtils } from '@/lib/hooks/use-message-utils';
import { useThreadUtils } from '@/lib/hooks/use-thread-utils';
import { useAIGeneration } from '@/lib/hooks/use-ai-generation';
import { useModelUtils } from '@/lib/hooks/use-model-utils';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { useMessageActions } from '@/lib/hooks/use-message-actions';
import { useClipboardActions } from '@/lib/hooks/use-clipboard-actions';

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
  // Worker
  const workerRef = useRef<Worker | null>(null);

  const { addMessage, updateMessage, deleteMessage, copyMessage, pasteMessage } = useMessagesMutation();

  // Use the thread data hook for thread loading functionality
  const { fetchSingleThread, createWelcomeThread, syncWelcomeThreadToBackend, loadThreads } = useThreadData({
    setThreads,
    setCurrentThread,
    isSignedIn: isSignedIn || false
  });

  // Use the message utils hook
  const {
    extractTextFromContent,
    startEditingMessage,
    confirmEditingMessage,
    cancelEditingMessage,
    updateMessageContent
  } = useMessageUtils({
    editingContent,
    editingMessage,
    setEditingContent,
    setEditingMessage,
    setThreads
  });

  // Use the thread utils hook
  const {
    findMessageAndParents,
    getSiblings,
    findMessageById,
    startEditingThreadTitle,
    SaveThreadToBackend,
    debouncedSaveThreadToBackend,
    confirmEditThreadTitle,
    cancelEditThreadTitle,
    toggleCollapse,
    collapseDeepChildren
  } = useThreadUtils({
    setThreads,
    editingThreadTitle,
    originalThreadTitle,
    setEditingThreadTitle,
    setOriginalThreadTitle
  });

  // Use the AI generation hook
  const {
    isGenerating: aiIsGenerating,
    keyInfo: aiKeyInfo,
    refreshUsage,
    generateAIReply,
    getModelDetails,
    abortControllersRef
  } = useAIGeneration({
    threads,
    models,
    selectedModels,
    findMessageById,
    updateMessageContent,
    setActiveTab,
    isSignedIn: isSignedIn ?? false,
    reloadUserProfile: async () => {
      reloadUserProfile();
      return Promise.resolve();
    }
  });

  // Add useModelUtils hook
  const {
    fetchAvailableModels,
    fetchModelParameters,
    handleModelChange,
    saveModelChanges,
    deleteModel,
    addNewModel
  } = useModelUtils({
    models,
    setModels,
    setEditingModel,
    selectedModels,
    setSelectedModels,
    setAvailableModels
  });

  // Use the message actions hook
  const { addEmptyReply, handleDeleteMessage } = useMessageActions({
    startEditingMessage
  });

  // Use the clipboard actions hook
  const { copyOrCutMessage, handlePasteMessage } = useClipboardActions({
    clipboardMessage,
    setClipboardMessage,
    clearGlowingMessages,
    addGlowingMessage,
    findMessageById,
    threads
  });

  // Add useKeyboardShortcuts hook
  const { handleKeyDown } = useKeyboardShortcuts({
    selectedMessages,
    editingMessage,
    currentThread,
    editingThreadTitle,
    cancelEditThreadTitle: () => {
      setEditingThreadTitle("");
      setOriginalThreadTitle("");
    },
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
  });

  // Add event listener for keyboard shortcuts
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

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

  // Fetch available models from the API or cache
  // Change the model

  // Load threads
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

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

  // This is a local function for side effects, not provided by the hook
  const deleteThread = useCallback((threadId: string) => {
    // Clear any selected messages for this thread
    setSelectedMessages(prev => {
      const newState = { ...prev };
      delete newState[threadId];
      return newState;
    });
  }, [setSelectedMessages]);

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