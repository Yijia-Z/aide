"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import debounce from "lodash.debounce";
import Draggable from "react-draggable";

import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Edit,
  Trash,
  Trash2,
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
  Scissors,
  ClipboardPaste,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge"
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
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { storage } from "./store";

const DEFAULT_MODEL: Model = {
  id: 'default',
  name: 'Default Model',
  baseModel: 'meta-llama/llama-3.2-3b-instruct:free',
  systemPrompt: `
  You are a helpful assistant.
  
  Use the tools when it's helpful, but if you can answer the user's question without it, feel free to do so.
  
  Do not mention tools to the user unless necessary. Provide clear and direct answers to the user's queries.
  `,
  parameters: {
    temperature: 1.3,
    top_p: 1,
    max_tokens: 1000,
  },
};

interface Message {
  id: string;
  content: string;
  publisher: "user" | "ai";
  modelId?: string;
  modelConfig?: Partial<Model>;
  replies: Message[];
  isCollapsed: boolean;
  userCollapsed: boolean;
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

function getSiblings(messages: Message[], messageId: string): Message[] {
  const [_, parents] = findMessageAndParents(messages, messageId);
  if (parents.length === 0) return messages;
  return parents[parents.length - 1].replies;
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
  replyingTo: string | null,
  tools,
  onData: (chunk: string) => void
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
      ...model.parameters,
      tools,
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
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let doneReading = false;
  while (!doneReading) {
    const { value, done } = await reader.read();
    doneReading = done;
    if (value) {
      const chunkValue = decoder.decode(value, { stream: true });
      onData(chunkValue); // 使用回调处理每个数据块
    }
  }
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
  const [clipboardMessage, setClipboardMessage] = useState<{
    message: Message;
    operation: "copy" | "cut";
    sourceThreadId: string | null;
    originalMessageId: string | null;
  } | null>(null);
  const [glowingMessageId, setGlowingMessageId] = useState<string | null>(null);
  const replyBoxRef = useRef<HTMLDivElement>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
const [tools, setTools] = useState([
  {
    name: 'Get Current Weather',
    description: 'Provides the current weather for a specified location.',
    enabled: false,
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get the current weather in a given location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
          },
        },
        required: ['location'],
      },
    },
  },
  
]);
const [newTool, setNewTool] = useState({
  name: '',
  description: '',
  parameters: '',
});
const openToolModal = () => {
  setIsToolModalOpen(true);
};

const closeToolModal = () => {
  setIsToolModalOpen(false);
};

const handleToolInputChange = (e) => {
  const { name, value } = e.target;
  setNewTool((prev) => ({ ...prev, [name]: value }));
};

const addCustomTool = () => {
  try {
    const parameters = JSON.parse(newTool.parameters);
    const customTool = {
      name: newTool.name,
      description: newTool.description,
      enabled: false,
      type: 'function',
      function: {
        name: newTool.name.toLowerCase().replace(/\s+/g, '_'),
        description: newTool.description,
        parameters,
      },
    };
    setTools((prev) => [...prev, customTool]);
    setNewTool({ name: '', description: '', parameters: '' });
  } catch (error) {
    alert('参数中的 JSON 无效');
  }
};

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
/*   useEffect(() => {
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
 */
  const debouncedSaveThreads = useCallback(
    debounce(async (threadsToSave: Thread[]) => {
      try {
        // Save to localStorage first
        storage.set('threads', threadsToSave);

        // Only save to backend if apiBaseUrl is available
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

          const results = await Promise.all(savePromises);
          console.log(
            "All threads have been successfully saved.",
            results
          );
        }
      } catch (error) {
        console.error("Failed to save threads:", error);
      }
    }, 2000),
    [apiBaseUrl]
  );

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        // First try to load from localStorage
        const cachedThreads = storage.get('threads');
        if (cachedThreads) {
          setThreads(cachedThreads);
          setCurrentThread(cachedThreads[0]?.id || null);
          return;
        }

        // If no cached data and no apiBaseUrl, create default thread
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

        // If apiBaseUrl exists, try to load from API
        const response = await fetch(`${apiBaseUrl}/api/load_threads`, {
          method: "GET",
        });

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
        // Create a default thread if loading fails
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
  }, [apiBaseUrl]);

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
            modelId: publisher === "ai" ? model?.id : undefined,
            modelConfig: publisher === "ai" ? { ...model } : undefined, // Add this line
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
    [editingModel]
  );

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
  
        const enabledTools = tools
          .filter((tool) => tool.enabled)
          .map((tool) => ({
            type: tool.type,
            function: tool.function,
          }));
  
        for (let i = 0; i < count; i++) {
          const newMessageId = Date.now().toString();
          addMessage(threadId, messageId, "", "ai", newMessageId);
          setSelectedMessage(newMessageId);
  
          let fullResponse = "";
          await generateAIResponse(
            message.content,
            message.publisher,
            model,
            threads,
            threadId,
            messageId,
            enabledTools,
            (chunk) => {
              // 处理每个数据块
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const dataStr = line.replace("data:", "").trim();
                  if (dataStr === "[DONE]") {
                    // 结束符，停止处理
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
            }
          );
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
      tools,
    ]
  );
  
        

        /* for (let i = 0; i < count; i++) {
          const reader = await generateAIResponse(
            message.content,
            message.publisher,
            model,
            threads,
            threadId,
            messageId,
            enabledTools
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
        } */


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
    const indent = depth === 0 ? 0 : (isSelectedOrParent ? -16 : 0);

    // Helper functions
    const getTotalReplies = (msg: Message): number => {
      return msg.replies.reduce((total, reply) => total + 1 + getTotalReplies(reply), 0);
    };

    const handleCopy = (codeString: string, codeBlockId: string) => {
      navigator.clipboard.writeText(codeString);
      setCopiedStates(prev => ({ ...prev, [codeBlockId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeBlockId]: false }));
      }, 2000);
    };

    const updateMessageModelConfig = (messages: Message[], targetId: string, newModelName: string): Message[] => {
      return messages.map((message) => {
        if (message.id === targetId) {
          return { ...message, modelConfig: { ...message.modelConfig, name: newModelName } };
        }
        if (message.replies.length > 0) {
          return { ...message, replies: updateMessageModelConfig(message.replies, targetId, newModelName) };
        }
        return message;
      });
    };

    // Thread and message data
    const currentThreadData = threads.find((t) => t.id === currentThread);
    if (!currentThreadData) return null;

    const [currentMessage, parentMessages] = findMessageAndParents(currentThreadData.messages, message.id);
    const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
    const siblings = getSiblings(currentThreadData.messages, message.id);
    const currentIndex = siblings.findIndex((m) => m.id === message.id);

    // Additional data
    const totalReplies = getTotalReplies(message);
    const modelDetails = message.modelConfig;
    const modelName = getModelDetails(message.modelId)?.name;
    if (modelName && modelDetails && modelName !== modelDetails.name) {
      // Update the original message's modelConfig name only
      setThreads((prevThreads) =>
        prevThreads.map((thread) => ({
          ...thread,
          messages: updateMessageModelConfig(thread.messages, message.id, modelName)
        }))
      );
    }

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{
          duration: 0.3,
          ease: "easeInOut"
        }}
        className={"mt-2"}
        style={{ marginLeft: `${indent}px` }}
        layout={"preserve-aspect"} // Add this prop to enable layout animations
        id={`message-${message.id}`}
      >
        <div
          className={`flex 
        items-start 
        space-x-1 
        p-1 
        rounded-md
        ${isSelectedOrParent ? "custom-shadow" : "text-muted-foreground"}
        ${glowingMessageId === message.id ? "glow-effect" : ""}
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
                    className="w-6 h-6 p-0 rounded-md hover:bg-secondary bg-background border border-border"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(threadId, message.id);
                    }}
                  >
                    {message.isCollapsed ? (
                      message.userCollapsed ? (
                        <ChevronRight className="h-4 m-0 transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 m-0 transition-transform text-muted-foreground" />
                      )
                    ) : (
                      <ChevronRight className="h-4 m-0 transition-transform rotate-90" />
                    )}
                  </Button>                  <span
                    className={`font-bold truncate ${message.publisher === "ai"
                      ? "text-blue-500"
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
                        ? modelDetails?.name || "AI"
                        : "User"
                      : null}
                  </span>
                  {modelDetails && (
                    <div className="flex items-center space-x-1">
                      <Badge variant="secondary">
                        {modelDetails.baseModel?.split('/').pop()?.split('-')[0]}
                      </Badge>
                    </div>
                  )}
                </div>
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
                      onMouseEnter={() => setGlowingMessageId(parentMessage.id)}
                      onMouseLeave={() => setGlowingMessageId(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {currentMessage?.replies && currentMessage.replies.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(currentMessage.replies[0].id);
                      }}
                      onMouseEnter={() => setGlowingMessageId(currentMessage.replies[0].id)}
                      onMouseLeave={() => setGlowingMessageId(null)}
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
                      onMouseEnter={() => setGlowingMessageId(siblings[currentIndex - 1].id)}
                      onMouseLeave={() => setGlowingMessageId(null)}
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
                      onMouseEnter={() => setGlowingMessageId(siblings[currentIndex + 1].id)}
                      onMouseLeave={() => setGlowingMessageId(null)}
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
                  className="min-font-size font-serif flex-grow w-auto m-1 p-0 bg-inherit"
                  style={{
                    minHeight: Math.min(
                      Math.max(
                        20,
                        editingContent.split("\n").length * (
                          window.innerWidth < 480 ? 35 :
                            window.innerWidth < 640 ? 30 :
                              window.innerWidth < 1024 ? 25 :
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
                <ContextMenu>
                  <ContextMenuTrigger onContextMenu={() => setSelectedMessage(message.id)}>
                    <div
                      className="whitespace-normal break-words markdown-content font-serif overflow-hidden pt-0.5 px-1 "
                      onDoubleClick={() => {
                        cancelEditingMessage();
                        startEditingMessage(message);
                      }}
                    >
                      {message.isCollapsed ? (
                        <div className="flex flex-col">
                          <div>
                            {`${message.content.split("\n")[0].slice(0, 50)}
                        ${message.content.length > 50 ? "..." : ""}`}
                          </div>
                          {totalReplies > 0 && (
                            <div className="self-end">
                              <span className="text-yellow-600">
                                {`(${totalReplies} ${totalReplies === 1 ? "reply" : "replies"})`}
                              </span>
                            </div>
                          )}
                        </div>
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
                                // Create a unique ID for each code block within the message
                                const codeBlockId = `${message.id}-${match?.[1] || 'unknown'}-${codeString.slice(0, 32)}`;
                                return !inline && match ? (
                                  <div className="relative">
                                    <div className="absolute -top-4 w-full text-muted-foreground flex justify-between items-center p-1 pb-0 pl-3 rounded-sm text-xs bg-[#1D2021]">
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
                  </ContextMenuTrigger>
                  <ContextMenuContent className="custom-shadow bg-transparent">
                    <ContextMenuItem onClick={() => addEmptyReply(threadId, message.id)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Reply
                      <ContextMenuShortcut>R</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => generateAIReply(threadId, message.id, 1)}>
                      <Sparkle className="h-4 w-4 mr-2" />
                      Generate AI Reply
                      <ContextMenuShortcut>G</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                      cancelEditingMessage();
                      startEditingMessage(message);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                      <ContextMenuShortcut>E</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => copyOrCutMessage(threadId, message.id, "copy")}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                      <ContextMenuShortcut>⌘ C</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => copyOrCutMessage(threadId, message.id, "cut")}>
                      <Scissors className="h-4 w-4 mr-2" />
                      Cut
                      <ContextMenuShortcut>⌘ X</ContextMenuShortcut>
                    </ContextMenuItem>
                    {clipboardMessage && (
                      <ContextMenuItem onClick={() => pasteMessage(threadId, message.id)}>
                        <ClipboardPaste className="h-4 w-4 mr-2" />
                        Paste
                        <ContextMenuShortcut>⌘ V</ContextMenuShortcut>
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-red-500"
                      onClick={() => deleteMessage(threadId, message.id, false)}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                      <ContextMenuShortcut>⌫</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-red-500"
                      onClick={() => deleteMessage(threadId, message.id, true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete with Replies
                      <ContextMenuShortcut className="ml-2">⇧ ⌫</ContextMenuShortcut>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}
            </div>
            {selectedMessage === message.id && (
              <div className="space-x-1 mt-1 flex flex-wrap items-center select-none">
                {editingMessage === message.id ? (
                  <>
                    <Button
                      className="hover:bg-background space-x-2 transition-scale-zoom"
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
                      className="hover:bg-background space-x-2 transition-scale-zoom"
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
                      className="h-10 hover:bg-background transition-scale-zoom"
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
                            "h-10 rounded-lg hover:bg-blue-900 transition-scale-zoom",
                            isGenerating &&
                            "animate-pulse bg-blue-200 dark:bg-blue-900 duration-1000"
                          )}
                        >
                          <Sparkle className="h-4 w-4" />
                          <span className="hidden md:inline ml-2">
                            Generate
                          </span>
                        </MenubarTrigger>
                        <MenubarContent className="custom-shadow">
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
                      className="h-10 hover:bg-background transition-scale-zoom"
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
                        <MenubarTrigger className="h-10 hover:bg-background transition-scale-zoom">
                          {clipboardMessage ? (
                            <ClipboardPaste className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="hidden md:inline ml-2">
                            {clipboardMessage ? "Paste" : "Copy"}
                          </span>
                        </MenubarTrigger>
                        <MenubarContent className="custom-shadow">
                          {clipboardMessage ? (
                            <>
                              <MenubarItem onClick={() => pasteMessage(threadId, message.id)}>
                                Paste Here
                                <span className="hidden md:inline ml-auto">
                                  <MenubarShortcut>⌘ V</MenubarShortcut>
                                </span>
                              </MenubarItem>
                              <MenubarItem onClick={() => setClipboardMessage(null)}>
                                Clear Clipboard
                                <span className="hidden md:inline ml-auto">
                                  <MenubarShortcut>Esc</MenubarShortcut>
                                </span>
                              </MenubarItem>
                            </>
                          ) : (
                            <>
                              <MenubarItem onClick={() => copyOrCutMessage(threadId, message.id, "copy")}>
                                Copy
                                <span className="hidden md:inline ml-auto">
                                  <MenubarShortcut>⌘ C</MenubarShortcut>
                                </span>
                              </MenubarItem>
                              <MenubarItem onClick={() => copyOrCutMessage(threadId, message.id, "cut")}>
                                Cut
                                <span className="hidden md:inline ml-auto">
                                  <MenubarShortcut>⌘ X</MenubarShortcut>
                                </span>
                              </MenubarItem>
                            </>
                          )}
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>
                    <Menubar className="p-0 border-none bg-transparent">
                      <MenubarMenu>
                        <MenubarTrigger className="h-10 hover:bg-destructive transition-scale-zoom">
                          <Trash className="h-4 w-4" />
                          <span className="hidden md:inline ml-2">Delete</span>
                        </MenubarTrigger>
                        <MenubarContent className="custom-shadow">
                          <MenubarItem
                            onClick={() =>
                              deleteMessage(threadId, message.id, false)
                            }
                          >
                            Keep Replies
                            <span className="hidden md:inline ml-auto">
                              <MenubarShortcut>⌫</MenubarShortcut>
                            </span>
                          </MenubarItem>
                          <MenubarItem
                            onClick={() =>
                              deleteMessage(threadId, message.id, true)
                            }
                          >
                            With Replies
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
        <AnimatePresence>
          {!message.isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.1 }}
            >
              {message.replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`${isSelected ? "border-l-2 border-b-2 rounded-bl-lg border-border ml-4" : "ml-4"}`}
                >
                  {renderMessage(reply, threadId, depth + 1, message.id)}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

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
      systemPrompt: `
  You are a helpful assistant.
  
  You have access to the following tool:
  
  - get_current_weather: Get the current weather in a given location.
  
  Use the tool when it's helpful, but if you can answer the user's question without it, feel free to do so.
  
  Do not mention tools to the user unless necessary. Provide clear and direct answers to the user's queries.
  `,
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
        // Handle copy/paste operations that only require thread selection
        if (currentThread) {
          switch (event.key) {
            case 'c':
              if ((event.metaKey || event.ctrlKey) && selectedMessage) {
                event.preventDefault();
                copyOrCutMessage(currentThread, selectedMessage, "copy");
              }
              break;
            case 'x':
              if ((event.metaKey || event.ctrlKey) && selectedMessage) {
                event.preventDefault();
                copyOrCutMessage(currentThread, selectedMessage, "cut");
              }
              break;
            case 'v':
              if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                if (clipboardMessage) {
                  // If no message is selected, paste at thread root level
                  pasteMessage(currentThread, selectedMessage || null);
                }
              }
              break;
            case 'Escape':
              if (clipboardMessage) {
                setClipboardMessage(null);
              }
              break;
          }
        }

        // Handle operations that require both thread and message selection
        if (!selectedMessage || !currentThread) return;

        const currentThreadData = threads.find((t) => t.id === currentThread);
        if (!currentThreadData) return;

        const [currentMessage, parentMessages] = findMessageAndParents(currentThreadData.messages, selectedMessage);
        const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
        if (!currentMessage) return;

        const siblings = getSiblings(currentThreadData.messages, selectedMessage);
        const currentIndex = siblings.findIndex((m) => m.id === currentMessage.id);

        switch (event.key) {
          case "ArrowLeft":
            if (parentMessage) {
              setSelectedMessage(parentMessage.id);
            }
            break;
          case "ArrowRight":
            if (currentMessage.replies.length > 0) {
              setSelectedMessage(currentMessage.replies[0].id);
            }
            break;
          case "ArrowUp":
            if (currentIndex > 0) {
              setSelectedMessage(siblings[currentIndex - 1].id);
            }
            break;
          case "ArrowDown":
            if (currentIndex < siblings.length - 1) {
              setSelectedMessage(siblings[currentIndex + 1].id);
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
    // Sort threads with newer threads (higher id) at the top, and pinned threads taking precedence
    const sortedThreads = threads.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return parseInt(b.id) - parseInt(a.id); // Assuming id is a string representation of a number
    });

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
            className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
            size="default"
            onClick={() => {
              addThread();
              setSelectedMessage(null);
            }}
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
          <AnimatePresence>
            <motion.div className="my-2">
              {sortedThreads.map((thread) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.1 }}
                  whileHover={{
                    borderRadius: '8px',
                    y: -2,
                    transition: { duration: 0.2 }
                  }}
                  className={`
                    font-serif
                    pl-1
                    cursor-pointer
                    rounded-md
                    mb-2
                    hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]
                    active:shadow-[inset_0px_0px_10px_rgba(0,0,0,0.7)]
                    ${currentThread === thread.id
                      ? "bg-background custom-shadow"
                      : "bg-transparent text-muted-foreground"
                    }
                  `}
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
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
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
              className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border select-none"
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
        <ScrollArea className="flex-grow" onClick={() => setSelectedMessage(null)}>
          <div className="mb-4" onClick={(e) => e.stopPropagation()}>
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
            <span>  Shift+Delete          ┃ Delete with replies</span>
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
          <Select value={selectedModel ?? models[0]?.id} onValueChange={setSelectedModel}>
            <SelectTrigger className="custom-shadow transition-scale-zoom">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="custom-shadow">
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
            size="default"
            onClick={addNewModel}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">New Model</span>
          </Button>
        </div>
        <ScrollArea className="flex-grow">
          <AnimatePresence>
            <motion.div className="flex-grow overflow-y-visible mt-2">
              {models.map((model) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.1 }}
                  whileHover={{
                    boxShadow: 'inset 0px 0px 10px rgba(128, 128, 128, 0.2)',
                    borderRadius: '8px',
                    transition: { duration: 0.2 }
                  }}
                  className="p-2 border rounded-md mb-2 custom-shadow"                >
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
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
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
                {renderThreadsList()}
              </TabsContent>
              <TabsContent value="models" className="flex-grow overflow-y-clip">
                {renderModelConfig()}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle className="mx-2 p-px bg-gradient-to-b from-background via-transparent to-background" />
          <ResizablePanel defaultSize={69}>
            <div className="h-full overflow-y-auto">{renderMessages()}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Draggable>
        <div
          className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg cursor-pointer z-50"
          onClick={openToolModal}
        >
          <Plus className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </div>
      </Draggable>
      <AnimatePresence>
        {isToolModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white dark:bg-gray-800 p-6 rounded-md shadow-lg w-11/12 max-w-md overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-4">管理工具</h2>
              <div className="space-y-4">
                {tools.map((tool, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                    <Switch
                      checked={tool.enabled}
                      onCheckedChange={(value) => {
                        const updatedTools = [...tools];
                        updatedTools[index].enabled = value;
                        setTools(updatedTools);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4 space-x-2">
                <Button variant="outline" onClick={closeToolModal}>
                  关闭
                </Button>
                <Button onClick={addCustomTool}>添加工具</Button>
              </div>
              {/* 添加自定义工具表单 */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">添加自定义工具</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tool-name">工具名称</Label>
                    <Input
                      id="tool-name"
                      name="name"
                      value={newTool.name}
                      onChange={handleToolInputChange}
                      placeholder="工具名称"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tool-description">描述</Label>
                    <Textarea
                      id="tool-description"
                      name="description"
                      value={newTool.description}
                      onChange={handleToolInputChange}
                      placeholder="工具描述"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tool-parameters">参数（JSON）</Label>
                    <Textarea
                      id="tool-parameters"
                      name="parameters"
                      value={newTool.parameters}
                      onChange={handleToolInputChange}
                      placeholder='{"type": "object", "properties": {...}}'
                    />
                  </div>
                  <Button onClick={addCustomTool}>添加工具</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
  );
}
