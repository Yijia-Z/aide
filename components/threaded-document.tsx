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
import ThreadList from "@/components/thread/thread-list";
import ModelConfig from "./model/model-config";
import RenderMessages from "@/components/message/render-all-messages";
import { ToolManager } from "./tool/tool-manager";
import { generateAIResponse } from "@/components/utils/api";
import { Thread, Message, Model, ModelParameters, Tool } from "./types";
import { useModels } from "./hooks/use-models";
import { useThreads } from "./hooks/use-threads";
import { useMessages } from "./hooks/use-messages";
import { useSession, signOut } from "next-auth/react"
import { SettingsPanel } from "./settings/settings-panel"
import { useTools } from "./hooks/use-tools";
import { AlignJustify, MessageSquare, Sparkle, Settings, Package } from "lucide-react";

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
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models" | "tools" | "settings">(
    (storage.get('activeTab') || "threads") as "threads" | "messages" | "models" | "tools" | "settings"
    //!session ? "settings" : "threads"
  )
  const user = session?.user

  const handleLogout = () => {
    signOut()
  }

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
    selectedModel,
    setSelectedModel,
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

  const loadTools = useCallback(async () => {
    if (apiBaseUrl) {
      setToolsLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/load_tools`);
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
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
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
      // console.log("Received data from OpenRouter:", data);

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

  // useCallback methods
  // Save threads
  const saveThreads = useCallback(async (threadsToSave: Thread[]) => {
    try {
      storage.set("threads", threadsToSave);
      if (apiBaseUrl) {
        const savePromises = threadsToSave.map((thread: Thread) =>
          fetch(`${apiBaseUrl}/api/save_thread`, {
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

  const debouncedSaveThreads = useMemo(
    () => debounce(saveThreads, 2000),
    [saveThreads]
  );

  // Add new thread
  const addThread = useCallback(() => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: "",
      messages: [],
      isPinned: false,
    };
    setThreads((prev) => [...prev, newThread]);
    setCurrentThread(newThread.id);
    setEditingThreadTitle(newThread.id);
    setOriginalThreadTitle("");
    setNewThreadId(newThread.id);
  }, [
    setCurrentThread,
    setEditingThreadTitle,
    setOriginalThreadTitle,
    setThreads,
    setNewThreadId,
  ]);

  // Add message
  const addMessage = useCallback(
    (
      threadId: string,
      parentId: string | null,
      content: string,
      publisher: "user" | "ai",
      newMessageId?: string
    ) => {
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;
          const model = models.find((m) => m.id === selectedModel);
          const newMessage: Message = {
            id: newMessageId || Date.now().toString(),
            content,
            publisher,
            modelId: publisher === "ai" ? model?.id : undefined,
            modelConfig: publisher === "ai" ? { ...model } : undefined,
            replies: [],
            isCollapsed: false,
            userCollapsed: false,
          };
          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: newMessage.id }));

          const addReplyToMessage = (message: Message): Message => {
            if (message.id === parentId) {
              return { ...message, replies: [...message.replies, newMessage] };
            }
            return {
              ...message,
              replies: message.replies.map(addReplyToMessage),
            };
          };

          if (!parentId) {
            return { ...thread, messages: [...thread.messages, newMessage] };
          }
          return {
            ...thread,
            messages: thread.messages.map(addReplyToMessage),
          };
        })
      );
    },
    [models, selectedModel, setSelectedMessages, currentThread, setThreads]
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
  const saveThreadToBackend = useCallback(
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
            const response = await fetch(`${apiBaseUrl}/api/save_thread`, {
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
  );

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
      saveThreadToBackend(threadId, { title: newTitle });
    },
    [
      saveThreadToBackend,
      setEditingThreadTitle,
      setOriginalThreadTitle,
      setThreads,
    ]
  );

  // Start editing a message
  const startEditingMessage = useCallback(
    (message: Message) => {
      setEditingMessage(message.id);
      setEditingContent(message.content);
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
      const newMessageId = Date.now().toString();
      addMessage(threadId, parentId, "", "user", newMessageId);

      startEditingMessage({
        id: newMessageId,
        content: "",
        publisher: "user",
        replies: [],
        isCollapsed: false,
        userCollapsed: false,
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

        navigator.clipboard.writeText(message.content);

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
            if (message.id === editingMessage) {
              if (message.content.trim() === "") {
                // Call deleteMessage if the message is empty
                deleteMessage(thread.id, message.id, false);
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
      if (selectedModel === id) {
        setSelectedModel(models[0].id);
      }
    },
    [models, selectedModel, setModels, setSelectedModel]
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
  }, [setEditingModel, setModels]);

  const toggleThreadPin = useCallback(
    (threadId: string) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, isPinned: !thread.isPinned }
            : thread
        )
      );
    },
    [setThreads]
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev: Thread[]) => {
        const updatedThreads = prev.filter((thread) => thread.id !== threadId);
        if (currentThread === threadId) {
          const currentIndex = prev.findIndex(
            (thread) => thread.id === threadId
          );
          const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          setCurrentThread(
            updatedThreads.length > 0
              ? updatedThreads[newIndex]?.id || null
              : null
          );
        }
        return updatedThreads;
      });

      const deleteThreadFromBackend = async () => {
        if (!apiBaseUrl) {
          return;
        }
        try {
          const response = await fetch(
            `${apiBaseUrl}/api/delete_thread/${threadId}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            }
          );
          if (!response.ok) {
            throw new Error(`Failed to delete thread ${threadId}`);
          }
          // console.log(`Thread ${threadId} has been successfully deleted.`);
        } catch (error) {
          console.error(`Failed to delete thread ${threadId} data:`, error);
        }
      };

      deleteThreadFromBackend();
    },
    [currentThread, setThreads, setCurrentThread]
  );

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
    [setThreads]
  );

  const pasteMessage = useCallback(
    (threadId: string, parentId: string | null) => {
      const messageToPaste = clipboardMessage?.message || {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
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
    [clipboardMessage, setClipboardMessage, clearGlowingMessages, setSelectedMessages, deleteMessage, updateMessageContent, currentThread, setThreads]
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
      // Manage abort controllers on a per-message basis
      const messageAbortController = new AbortController();
      const cleanup = () => {
        messageAbortController.abort();
        setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
      };

      // If already generating for this message, abort the current generation
      if (isGenerating[messageId] && messageAbortController) {
        cleanup();
        return;
      }

      const thread = threads.find((t: { id: string }) => t.id === threadId);
      if (!thread) return;

      const message = findMessageById(thread.messages, messageId);
      if (!message) return;

      try {
        const model =
          models.find((m: { id: any }) => m.id === selectedModel) || models[0];
        const enabledTools = (model.parameters?.tool_choice !== "none" && model.parameters?.tool_choice !== undefined ? model.parameters?.tools ?? [] : []) as Tool[];
        // window.alert(JSON.stringify(enabledTools));
        // window.alert(count)
        for (let i = 0; i < count; i++) {
          const newMessageId = Date.now().toString();
          addMessage(threadId, messageId, "", "ai", newMessageId);
          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: newMessageId }));

          setIsGenerating((prev) => ({ ...prev, [newMessageId]: true }));
          let fullResponse = "";
          try {
            await generateAIResponse(
              message.content,
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
                    if (dataStr === "[DONE]") {
                      return;
                    }
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
      currentThread,
      models,
      selectedModel,
      addMessage,
      findMessageById,
      setSelectedMessages,
      updateMessageContent,
      isGenerating,
    ]
  );

  // useEffect hooks
  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        // Clear existing threads first
        setThreads([]);
        setCurrentThread(null);

        const cachedThreads = storage.get("threads");
        if (cachedThreads) {
          setThreads(cachedThreads);
          setCurrentThread(cachedThreads[0]?.id || null);
          return;
        }

        if (!apiBaseUrl) {
          const defaultThread = {
            id: Date.now().toString(),
            title: "Welcome Thread",
            isPinned: false,
            messages: [
              {
                id: Date.now().toString(),
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
          setCurrentThread(defaultThread.id);
          storage.set("threads", [defaultThread]);
          return;
        }

        const response = await fetch(`${apiBaseUrl}/api/load_threads`, {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          const loadedThreads = data.threads || [];
          setThreads(loadedThreads);
          setCurrentThread(loadedThreads[0]?.id || null);
          storage.set("threads", loadedThreads);
        } else {
          throw new Error("Failed to load threads from backend");
        }
      } catch (error) {
        console.error("Load failed:", error);
        const defaultThread = {
          id: Date.now().toString(),
          title: "Welcome Thread",
          isPinned: false,
          messages: [
            {
              id: Date.now().toString(),
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
        setCurrentThread(defaultThread.id);
        storage.set("threads", [defaultThread]);
      }
    };

    loadThreads();
  }, [setCurrentThread, setThreads]);

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
        messageElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
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
  useEffect(() => {
    debouncedSaveThreads(threads);
    return () => {
      debouncedSaveThreads.cancel();
    };
  }, [threads, debouncedSaveThreads]);

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
        setSelectedModel(cachedModels[0]?.id || null);
        setModelsLoaded(true);
      }

      if (!apiBaseUrl) {
        // If no apiBaseUrl, ensure default model is set
        if (!cachedModels) {
          setModels([DEFAULT_MODEL]);
          setSelectedModel(DEFAULT_MODEL.id);
          setModelsLoaded(true);
        }
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/load_models`, {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          // console.log("Loaded models:", data.models);
          let loadedModels = data.models || [];

          // If no models are loaded, add the default model
          if (loadedModels.length === 0) {
            loadedModels = [DEFAULT_MODEL];
          }

          setModels(loadedModels);
          setSelectedModel(loadedModels[0].id);
          setModelsLoaded(true);

          // Update cache with the newly fetched models
          storage.set("models", loadedModels);
        } else {
          console.error("Failed to load models from backend.");
          // Ensure default model is set if loading fails and no cache exists
          if (!cachedModels) {
            setModels([DEFAULT_MODEL]);
            setSelectedModel(DEFAULT_MODEL.id);
            setModelsLoaded(true);
          }
        }
      } catch (error) {
        console.error("Error loading models:", error);
        // Ensure default model is set if an error occurs and no cache exists
        if (!cachedModels) {
          setModels([DEFAULT_MODEL]);
          setSelectedModel(DEFAULT_MODEL.id);
          setModelsLoaded(true);
        }
      }
    };

    loadModels();
  }, [setModels, setModelsLoaded, setSelectedModel]);

  // fetch available models
  useEffect(() => {
    const saveModels = async () => {
      if (!apiBaseUrl) {
        // Cache models to browser storage if apiBaseUrl is not present
        storage.set("models", models);
        return;
      }

      try {
        await fetch(`${apiBaseUrl}/api/save_models`, {
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
    <div className="h-screen flex flex-col md:flex-row p-2 md:pr-0 overflow-ellipsis ">
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
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              addNewModel={addNewModel}
              fetchAvailableModels={fetchAvailableModels}
              fetchModelParameters={fetchModelParameters}
              deleteModel={deleteModel}
              saveModelChanges={saveModelChanges}
              editingModel={editingModel}
              setEditingModel={setEditingModel}
              handleModelChange={handleModelChange}
              availableTools={availableTools}
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
              paddingBottom: "env(safe-area-inset-bottom)"
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
              pb-10
              space-x-1
              grid-cols-5
              select-none"
          >
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
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="threads"
                >
                  <AlignJustify className="h-5 w-5 group-hover:hidden" />
                  <span className="hidden group-hover:inline">Threads</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="models"
                >
                  <Sparkle className="h-5 w-5 group-hover:hidden" />
                  <span className="hidden group-hover:inline">Models</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="tools"
                >
                  <Package className="h-5 w-5 group-hover:hidden" />
                  <span className="hidden group-hover:inline">Tools</span>
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background group"
                  value="settings"
                >
                  <Settings className="h-5 w-5 group-hover:hidden" />
                  <span className="hidden group-hover:inline">Settings</span>
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
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  addNewModel={addNewModel}
                  fetchAvailableModels={fetchAvailableModels}
                  fetchModelParameters={fetchModelParameters}
                  deleteModel={deleteModel}
                  saveModelChanges={saveModelChanges}
                  editingModel={editingModel}
                  setEditingModel={setEditingModel}
                  handleModelChange={handleModelChange}
                  availableTools={availableTools}
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
