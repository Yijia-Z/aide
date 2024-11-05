"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import debounce from "lodash.debounce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { storage } from "./store";
import ThreadList from "@/components/thread/thread-list";
import ModelConfig from "./model/model-config";
import RenderMessages from "@/components/message/render-all-messages";
import { generateAIResponse } from "@/components/utils/api";
import { Thread, Message, Model, ModelParameters } from "./types";
import { useModels } from "./hooks/use-models";
import { useThreads } from "./hooks/use-threads";
import { useMessages } from "./hooks/use-messages";

const DEFAULT_MODEL: Model = {
  id: 'default',
  name: 'Default Model',
  baseModel: 'meta-llama/llama-3.2-3b-instruct:free',
  systemPrompt: 'You are a helpful assistant.',
  parameters: {
    temperature: 1.3,
    top_p: 1,
    max_tokens: 1000,
  },
};

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function ThreadedDocument() {
  // Thread-related states
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models">("threads");
  const {
    threads,
    setThreads,
    currentThread,
    setCurrentThread,
    editingThreadTitle,
    setEditingThreadTitle,
    originalThreadTitle,
    setOriginalThreadTitle,
  } = useThreads();
  const threadTitleInputRef = useRef<HTMLInputElement>(null);

  // Message-related states
  const {
    selectedMessage,
    setSelectedMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editingContent,
    setEditingContent,
    clipboardMessage,
    setClipboardMessage,
    glowingMessageId,
    setGlowingMessageId,
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Helper methods
  const getModelDetails = (modelId: string | undefined) => {
    if (!modelId) return null;
    const model = models.find(m => m.id === modelId);
    if (!model) return null;
    return {
      name: model.name,
      baseModel: model.baseModel.split('/').pop(),
      temperature: model.parameters.temperature,
      maxTokens: model.parameters.max_tokens,
      systemPrompt: model.systemPrompt,
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
    [editingContent]
  );

  const fetchAvailableModels = useCallback(async () => {
    try {
      // Check if models are already cached in localStorage
      const cachedModels = localStorage.getItem('availableModels');
      const lastFetchTime = localStorage.getItem('lastFetchTime');
      const currentTime = Date.now();

      // If cached models exist and were fetched less than an hour ago, use them
      if (cachedModels && lastFetchTime && currentTime - parseInt(lastFetchTime) < 3600000) {
        const modelData = JSON.parse(cachedModels);
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

      // Cache the fetched models and update the fetch time
      localStorage.setItem('availableModels', JSON.stringify(modelData));
      localStorage.setItem('lastFetchTime', currentTime.toString());

      setAvailableModels(modelData);
      return modelData;
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }, []); 


  // useCallback methods
  // Save threads
  const debouncedSaveThreads = useCallback(
    debounce(async (threadsToSave: Thread[]) => {
      try {
        storage.set('threads', threadsToSave);
        if (apiBaseUrl) {
          const savePromises = threadsToSave.map((thread: Thread) =>
            fetch(`${apiBaseUrl}/api/save_thread`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ threadId: thread.id, thread }),
            }).then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to save thread ${thread.id}`);
              }
              return response.json();
            })
          );
          await Promise.all(savePromises);
        }
      } catch (error) {
        console.error("Failed to save threads:", error);
      }
    }, 2000),
    [apiBaseUrl]
  );

  // Add new thread
  const addThread = useCallback(() => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: "New Thread",
      messages: [],
      isPinned: false,
    };
    setThreads((prev) => [...prev, newThread]);
    setCurrentThread(newThread.id);
    setEditingThreadTitle(newThread.id);
    setOriginalThreadTitle("New Thread");
  }, []);

  // Add message
  const addMessage = useCallback(
    (threadId: string, parentId: string | null, content: string, publisher: "user" | "ai", newMessageId?: string) => {
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

  // Change the model
  const handleModelChange = useCallback(
		(field: keyof Model, value: string | number | Partial<ModelParameters>) => {
			if (editingModel) {
				setEditingModel((prevModel) => {
					if (!prevModel) return prevModel;
					if (field === "parameters") {
						return {
							...prevModel,
							parameters: { ...prevModel.parameters, ...(value as Partial<ModelParameters>) }
						};
					}
					return { ...prevModel, [field]: value };
				});
			}
		},
		[editingModel]
	);

  // Find a message and its parents
	const findMessageAndParents = (
		messages: Message[],
		targetId: string,
		parents: Message[] = []
	): [Message | null, Message[]] => {
		for (const message of messages) {
			if (message.id === targetId) {
				return [message, parents];
			}
			const [found, foundParents] = findMessageAndParents(message.replies, targetId, [...parents, message]);
			if (found) {
				return [found, foundParents];
			}
		}
		return [null, []];
	};

  // Get siblings of a message
	const getSiblings = (messages: Message[], messageId: string): Message[] => {
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
	};

  // Start editing a thread title
	const startEditingThreadTitle = useCallback((threadId: string, currentTitle: string) => {
		setEditingThreadTitle(threadId);
		setOriginalThreadTitle(currentTitle);
	}, []);

  // Save thread to backend
	const saveThreadToBackend = useCallback(
    async (threadId: string, updatedData: Partial<Thread>) => {
      try {
        // Cache the thread data to local storage
        const cachedThreads = JSON.parse(localStorage.getItem('threads') || '[]');
        const updatedThreads = cachedThreads.map((thread: Thread) =>
          thread.id === threadId ? { ...thread, ...updatedData } : thread
        );
        localStorage.setItem('threads', JSON.stringify(updatedThreads));

        // Only update the backend if apiBaseUrl is available
        if (apiBaseUrl) {
          const lastUpdateTime = parseInt(localStorage.getItem('lastThreadUpdateTime') || '0');
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime > 60000) { // Update every 60 seconds
            const response = await fetch(`${apiBaseUrl}/api/save_thread`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ threadId, thread: { ...updatedData } }),
            });
            if (!response.ok) {
              throw new Error(`editthread ${threadId} fail`);
            }
            localStorage.setItem('lastThreadUpdateTime', currentTime.toString());
          }
        }
      } catch (error) {
        console.error(`update ${threadId} datafail:`, error);
      }
    },
    [apiBaseUrl]
  );

  // Confirm editing a thread title
	const confirmEditThreadTitle = useCallback((threadId: string, newTitle: string) => {
		setThreads((prev: Thread[]) => 
			prev.map((thread) => 
				thread.id === threadId ? { ...thread, title: newTitle } : thread
			)
		);
		setEditingThreadTitle(null);
		setOriginalThreadTitle(newTitle);
		saveThreadToBackend(threadId, { title: newTitle });
	}, [saveThreadToBackend]);

	// Start editing a message
  const startEditingMessage = useCallback((message: Message) => {
    setEditingMessage(message.id);
    setEditingContent(message.content);
  }, []);

	const cancelEditThreadTitle = useCallback(() => {
		if (editingThreadTitle) {
			setThreads((prev: Thread[]) => 
				prev.map((thread) => 
					thread.id === editingThreadTitle ? { ...thread, title: originalThreadTitle } : thread
				)
			);
			setEditingThreadTitle(null);
		}
	}, [editingThreadTitle, originalThreadTitle]);

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
    (threadId: string, messageId: string, deleteChildren: boolean) => {
      setThreads((prev: Thread[]) =>
        prev.map((thread) => {
          if (thread.id !== threadId) return thread;

          const removeMessage = (messages: Message[]): Message[] => {
            const [messageToDelete, parentMessages] = findMessageAndParents(messages, messageId);
            if (!messageToDelete) return messages;

            const filterAndMerge = (msgs: Message[]) =>
              deleteChildren
                ? msgs.filter((m) => m.id !== messageId)
                : [...msgs.filter((m) => m.id !== messageId), ...messageToDelete.replies];

            const updateSelection = (newMsgs: Message[], parentMsg?: Message) => {
              if (newMsgs.length > 0) {
                const index = messages.findIndex(m => m.id === messageId);
                const newSelectedId = index > 0 ? newMsgs[index - 1].id : newMsgs[0].id;
                setSelectedMessage(newSelectedId);
              } else if (parentMsg) {
                setSelectedMessage(parentMsg.id);
              } else {
                setSelectedMessage(null);
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
    [setSelectedMessage]
  );
	
  // Toggle message collapse state
  const toggleCollapse = useCallback((threadId: string, messageId: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const toggleMessage = (messages: Message[]): Message[] => {
          return messages.map((message) => {
            if (message.id === messageId) {
              return {
                ...message,
                isCollapsed: !message.isCollapsed,
                userCollapsed: !message.isCollapsed
              };
            }
            return { ...message, replies: toggleMessage(message.replies) };
          });
        };
        return { ...thread, messages: toggleMessage(thread.messages) };
      })
    );
  }, []);

	// Add helper function to deep clone a message and its replies with new IDs
  const cloneMessageWithNewIds = useCallback((message: Message): Message => {
    const newId = Date.now().toString() + Math.random().toString(36).slice(2);
    return {
      ...message,
      id: newId,
      replies: message.replies.map(reply => cloneMessageWithNewIds(reply))
    };
  }, []);

	// Add copy/cut function
  const copyOrCutMessage = useCallback((threadId: string, messageId: string, operation: "copy" | "cut") => {
    setThreads(prev => {
      const thread = prev.find(t => t.id === threadId);
      if (!thread) return prev;

      const [message] = findMessageAndParents(thread.messages, messageId);
      if (!message) return prev;

      setClipboardMessage({
        message: cloneMessageWithNewIds(message),
        operation,
        sourceThreadId: threadId,
        originalMessageId: messageId
      });

      return prev;
    });
  }, [cloneMessageWithNewIds]);

	// Cancel editing a message
  const cancelEditingMessage = useCallback(() => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) => {
        const removeEmptyMessage = (messages: Message[]): Message[] => {
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
  }, [editingMessage, deleteMessage]);

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

  const saveModelChanges = useCallback(() => {
    if (editingModel) {
      setModels((prev: Model[]) =>
        prev.map((model: Model) => {
          if (model.id === editingModel.id) {
            return { ...editingModel };
          }
          return model;
        })
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
          const currentIndex = prev.findIndex((thread) => thread.id === threadId);
          const newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          setCurrentThread(
            updatedThreads.length > 0 ? updatedThreads[newIndex]?.id || null : null
          );
        }
        return updatedThreads;
      });

      const deleteThreadFromBackend = async () => {
        if (!apiBaseUrl) {
          return;
        }
        try {
          const response = await fetch(`${apiBaseUrl}/api/delete_thread/${threadId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });
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
  
  
  const pasteMessage = useCallback((threadId: string, parentId: string | null) => {
    if (!clipboardMessage) return;

    // Don't allow pasting on the original message
    if (parentId === clipboardMessage.originalMessageId) return;

    setThreads(prev => {
      let updatedThreads = [...prev];

      // First handle deletion of original message if this was a cut operation
      if (clipboardMessage.operation === "cut" && clipboardMessage.sourceThreadId) {
        updatedThreads = updatedThreads.map(thread => {
          if (thread.id !== clipboardMessage.sourceThreadId) return thread;

          const deleteMessageFromThread = (messages: Message[]): Message[] => {
            return messages.filter(msg => {
              if (msg.id === clipboardMessage.originalMessageId) {
                return false;
              }
              msg.replies = deleteMessageFromThread(msg.replies);
              return true;
            });
          };

          return {
            ...thread,
            messages: deleteMessageFromThread(thread.messages)
          };
        });
      }

      // Then handle the paste operation
      return updatedThreads.map(thread => {
        if (thread.id !== threadId) return thread;

        // If thread has no messages array, initialize it
        if (!thread.messages) {
          thread.messages = [];
        }

        // If no parentId is provided or thread is empty, paste at the root level
        if (!parentId || thread.messages.length === 0) {
          return {
            ...thread,
            messages: [...thread.messages, clipboardMessage.message]
          };
        }

        // Otherwise, paste as a reply to the specified parent
        const addMessageToParent = (messages: Message[]): Message[] => {
          return messages.map(message => {
            if (message.id === parentId) {
              return {
                ...message,
                replies: [...message.replies, clipboardMessage.message]
              };
            }
            return {
              ...message,
              replies: addMessageToParent(message.replies)
            };
          });
        };

        return {
          ...thread,
          messages: addMessageToParent(thread.messages)
        };
      });
    });

    setSelectedMessage(clipboardMessage.message.id);
    setClipboardMessage(null);
  }, [clipboardMessage]);

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
  const collapseDeepChildren = useCallback((msg: Message, selectedDepth: number, currentDepth: number, isSelectedBranch: boolean): Message => {
    const maxDepth = window.innerWidth >= 1024 ? 8 :
      window.innerWidth >= 768 ? 7 :
        window.innerWidth >= 480 ? 6 : 5;

    const shouldAutoCollapse = isSelectedBranch
      ? currentDepth - selectedDepth >= maxDepth
      : currentDepth >= maxDepth;

    return {
      ...msg,
      isCollapsed: msg.userCollapsed || shouldAutoCollapse,
      replies: msg.replies.map(reply => collapseDeepChildren(reply, selectedDepth, currentDepth + 1, isSelectedBranch))
    };
  }, []);

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





  // useEffect hooks
  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        const cachedThreads = storage.get('threads');
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
            messages: [{
              id: Date.now().toString(),
              content: "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
              publisher: "ai" as const,
              replies: [],
              isCollapsed: false,
              userCollapsed: false,
            }]
          };
          setThreads([defaultThread]);
          setCurrentThread(defaultThread.id);
          storage.set('threads', [defaultThread]);
          return;
        }

        const response = await fetch(`${apiBaseUrl}/api/load_threads`, { method: "GET" });
        if (response.ok) {
          const data = await response.json();
          setThreads(data.threads || []);
          setCurrentThread(data.threads[0]?.id || null);
          storage.set('threads', data.threads || []);
        } else {
          throw new Error("Failed to load threads from backend");
        }
      } catch (error) {
        console.error("Load failed:", error);
        const defaultThread = {
          id: Date.now().toString(),
          title: "Welcome Thread",
          isPinned: false,
          messages: [{
            id: Date.now().toString(),
            content: "Welcome to your new chat thread! You can start a conversation here or create a new thread.",
            publisher: "ai" as const,
            replies: [],
            isCollapsed: false,
            userCollapsed: false,
          }]
        };
        setThreads([defaultThread]);
        setCurrentThread(defaultThread.id);
        storage.set('threads', [defaultThread]);
      }
    };

    loadThreads();
  }, []);

// Focus on thread title input when editing
useEffect(() => {
  if (editingThreadTitle && threadTitleInputRef.current) {
    threadTitleInputRef.current.focus();
  }
}, [editingThreadTitle]);


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
}, [isConnected, lastAttemptTime, apiBaseUrl]);

// Save threads
useEffect(() => {
  debouncedSaveThreads(threads);
  return debouncedSaveThreads.cancel;
}, [threads, debouncedSaveThreads]);

// Add new thread
useEffect(() => {
    const loadModels = async () => {
      // First, try to load models from cache
      const cachedModels = storage.get('models');
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
          console.log("Loaded models:", data.models);
          let loadedModels = data.models || [];

          // If no models are loaded, add the default model
          if (loadedModels.length === 0) {
            loadedModels = [DEFAULT_MODEL];
          }

          setModels(loadedModels);
          setSelectedModel(loadedModels[0].id);
          setModelsLoaded(true);

          // Update cache with the newly fetched models
          storage.set('models', loadedModels);
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
  }, []);


  // fetch available models
  useEffect(() => {
    const saveModels = async () => {
      if (!apiBaseUrl) {
        // Cache models to browser storage if apiBaseUrl is not present
        storage.set('models', models);
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
              setSelectedMessage={setSelectedMessage}
              setThreads={setThreads}
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
              selectedMessage={selectedMessage}
              editingMessage={editingMessage}
              editingContent={editingContent}
              glowingMessageId={glowingMessageId}
              copiedStates={copiedStates}
              clipboardMessage={clipboardMessage}
              isGenerating={isGenerating}
              setSelectedMessage={setSelectedMessage}
              toggleCollapse={toggleCollapse}
              setGlowingMessageId={setGlowingMessageId}
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
            />
          </TabsContent>
          <TabsList
            className="grid 
              bg-transparent
              custom-shadow
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
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
            >
              Threads
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
            >
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
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
              <TabsList className="grid w-full grid-cols-2 bg-transparent custom-shadow select-none">
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background"
                  value="threads"
                >Threads
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background"
                  value="models"
                >
                  Models
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
                  confirmEditThreadTitle={confirmEditThreadTitle} 
                  cancelEditThreadTitle={cancelEditThreadTitle} 
                  toggleThreadPin={toggleThreadPin} 
                  deleteThread={deleteThread}
                  editingThreadTitle={editingThreadTitle}
                  addThread={addThread}
                  setSelectedMessage={setSelectedMessage}
                  setThreads={setThreads}
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
                /> 
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle className="mx-2 p-px bg-gradient-to-b from-background via-transparent to-background" />
          <ResizablePanel defaultSize={69}>
            <div className="h-full overflow-y-auto">
              <RenderMessages
                threads={threads}
                currentThread={currentThread}
                selectedMessage={selectedMessage}
                editingMessage={editingMessage}
                editingContent={editingContent}
                glowingMessageId={glowingMessageId}
                copiedStates={copiedStates}
                clipboardMessage={clipboardMessage}
                isGenerating={isGenerating}
                setSelectedMessage={setSelectedMessage}
                toggleCollapse={toggleCollapse}
                setGlowingMessageId={setGlowingMessageId}
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
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}