"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import debounce from "lodash.debounce";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SelectBaseModel } from "@/components/model/model-selector";
import { storage } from "./store";
import ThreadList from "@/components/thread/thread-list";
import MessageList from "@/components/message/message-list";
import MessageEditor from "@/components/message/message-editor";
import AideTabs from "@/components/ui/aide-tabs";
import { Thread, Message, Model, ModelParameters } from "./types";

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
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models">("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null);
  const [originalThreadTitle, setOriginalThreadTitle] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([DEFAULT_MODEL]);
  const [selectedModel, setSelectedModel] = useState<string | null>(DEFAULT_MODEL.id);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clipboardMessage, setClipboardMessage] = useState<{
    message: Message;
    operation: "copy" | "cut";
    sourceThreadId: string;
    originalMessageId: string;
  } | null>(null);

  const threadTitleInputRef = useRef<HTMLInputElement>(null);
  const replyBoxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    debouncedSaveThreads(threads);
    return debouncedSaveThreads.cancel;
  }, [threads, debouncedSaveThreads]);

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

	const findAllParentMessages = (
		threads: Thread[],
		currentThreadId: string | null,
		replyingToId: string | null
	): Message[] => {
		if (!currentThreadId || !replyingToId) return [];

		const currentThread = threads.find(t => t.id === currentThreadId);
		if (!currentThread) return [];

		const [targetMessage, parents] = findMessageAndParents(currentThread.messages, replyingToId);
		return parents.concat(targetMessage ? [targetMessage] : []);
	};

	const startEditingThreadTitle = useCallback((threadId: string, currentTitle: string) => {
		setEditingThreadTitle(threadId);
		setOriginalThreadTitle(currentTitle);
	}, []);

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


  return (
    <div className="flex flex-col h-screen">
      <AideTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        renderThreadsList={() => (
          <ThreadList
            threads={threads}
            currentThread={currentThread}
            onAddThread={addThread}
            onSelectThread={setCurrentThread}
            onEditThreadTitle={startEditingThreadTitle}
            onDeleteThread={(threadId) => {
              setThreads((prev) => prev.filter((t) => t.id !== threadId));
              if (currentThread === threadId) {
                setCurrentThread((prev) => (threads[0]?.id) || null);
              }
            }}
            onPinThread={(threadId) => {
              setThreads((prev) =>
                prev.map((thread) =>
                  thread.id === threadId ? { ...thread, isPinned: !thread.isPinned } : thread
                )
              );
            }}
          />
        )}
        renderMessages={() => (
          currentThread && (
            <MessageList
              messages={threads.find((t) => t.id === currentThread)?.messages || []}
              selectedMessage={selectedMessage}
              onSelectMessage={setSelectedMessage}
              onReplyToMessage={(messageId) => addEmptyReply(currentThread!, messageId)}
              onEditMessage={(id) => {
                const message = threads
                  .flatMap(thread => thread.messages)
                  .find(msg => msg.id === id);
                if (message) startEditingMessage(message);
              }}
              onDeleteMessage={(messageId) => deleteMessage(currentThread!, messageId, false)}
              onToggleMessageCollapse={(messageId) => toggleCollapse(currentThread!, messageId)}
              onCopyMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "copy")}
              onCutMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "cut")}
            />
          )
        )}
        renderModelConfig={() => (
					<SelectBaseModel
            value={editingModel?.baseModel || ''}
						onValueChange={(value, parameters) => {
							handleModelChange("baseModel", value);
							handleModelChange("parameters", parameters as Partial<ModelParameters>);
						}}
						fetchAvailableModels={fetchAvailableModels}
						fetchModelParameters={fetchModelParameters}
						existingParameters={editingModel?.parameters}
					/>
        )}
      />
			<Tabs>
				<div className="flex-grow overflow-hidden">
					<TabsContent value="threads" className="h-full">
						<ThreadList
							threads={threads}
							currentThread={currentThread}
							onAddThread={addThread}
							onSelectThread={setCurrentThread}
							onEditThreadTitle={startEditingThreadTitle}
							onDeleteThread={(threadId) => {
								setThreads((prev) => prev.filter((t) => t.id !== threadId));
								if (currentThread === threadId) {
									setCurrentThread((prev) => (threads[0]?.id) || null);
								}
							}}
							onPinThread={(threadId) => {
								setThreads((prev) =>
									prev.map((thread) =>
										thread.id === threadId ? { ...thread, isPinned: !thread.isPinned } : thread
									)
								);
							}}
						/>
					</TabsContent>
					<TabsContent value="messages" className="h-full">
						{currentThread && (
							<MessageList
									messages={threads.find((t) => t.id === currentThread)?.messages || []}
									selectedMessage={selectedMessage}
									onSelectMessage={setSelectedMessage}
									onReplyToMessage={(messageId) => addEmptyReply(currentThread!, messageId)}
									onEditMessage={(id) => {
										const message = threads
											.flatMap(thread => thread.messages)
											.find(msg => msg.id === id);
										if (message) startEditingMessage(message);
									}}
									onDeleteMessage={(messageId) => deleteMessage(currentThread!, messageId, false)}
									onToggleMessageCollapse={(messageId) => toggleCollapse(currentThread!, messageId)}
									onCopyMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "copy")}
									onCutMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "cut")}
							/>
						)}
					{editingMessage && (
							<MessageEditor
									initialContent={editingContent}
									onSave={(content) => {
										if (editingMessage) {
											addMessage(currentThread!, editingMessage, content, "user");
											setEditingMessage(null);
											setEditingContent("");
										}
									}}
									onCancel={cancelEditingMessage}
							/>
					)}
					</TabsContent>
					<TabsContent value="models" className="h-full">
						<SelectBaseModel
							value={editingModel?.baseModel || ''}
							onValueChange={(value, parameters) => {
								handleModelChange("baseModel", value);
								handleModelChange("parameters", parameters as Partial<ModelParameters>);
							}}
							fetchAvailableModels={fetchAvailableModels}
							fetchModelParameters={fetchModelParameters}
							existingParameters={editingModel?.parameters}
						/>	
					</TabsContent>
				</div>
			</Tabs>	
    </div>
  );
}