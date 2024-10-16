"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { cn } from "@/lib/utils";

import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

const MESSAGE_INDENT = 12; // Constant value for indentation

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
  temperature: number;
  maxTokens: number;
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

  function findMessageAndParents(
    messages: Message[],
    targetId: string,
    parents: Message[] = []
  ): Message[] | null {
    for (const message of messages) {
      if (message.id === targetId) {
        return [...parents, message];
      }
      const found = findMessageAndParents(message.replies, targetId, [
        ...parents,
        message,
      ]);
      if (found) return found;
    }
    return null;
  }

  const parentMessages = findMessageAndParents(
    currentThread.messages,
    replyingToId
  );
  return parentMessages ? parentMessages.slice(0, -1) : [];
}

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
console.log("API Base URL:", apiBaseUrl);

// Function to generate AI response
async function generateAIResponse(
  prompt: string,
  model: Model,
  threads: Thread[],
  currentThread: string | null,
  replyingTo: string | null
) {
  const response = await fetch(
    apiBaseUrl ? `${apiBaseUrl}/api/chat` : "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: model.systemPrompt },
          ...prompt
            .split("\n")
            .map((line) => ({ role: "user", content: line })),
          ...findAllParentMessages(threads, currentThread, replyingTo).map(
            (msg) => ({
              role: msg.publisher === "user" ? "user" : "assistant",
              content: msg.content,
            })
          ),
          { role: "user", content: prompt },
        ],
        configuration: {
          model: model.baseModel,
          temperature: model.temperature,
          max_tokens: model.maxTokens,
        },
      }),
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
  const [activeTab, setActiveTab] = useState<"threads" | "messages" | "models">("threads");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null);
  const threadTitleInputRef = useRef<HTMLInputElement>(null);

  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const replyBoxRef = useRef<HTMLDivElement>(null);

  const [models, setModels] = useState<Model[]>([
    {
      id: "1",
      name: "Default Model",
      baseModel: "gpt-4o-mini",
      systemPrompt: "You are a helpful assistant.",
      temperature: 0.7,
      maxTokens: 512,
    },
  ]);
  const [selectedModel, setSelectedModel] = useState<string>(models[0].id);
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
      try {
        const response = await fetch(
          isConnected ? `${apiBaseUrl}/api/connect` : "/api/connect",
          { method: "GET" }
        );
        if (response.ok) {
          console.log("Connected to backend!");
          setIsConnected(true);
        } else {
          console.error("Failed to connect to backend.");
          setIsConnected(false);
        }
      } catch (error) {
        console.error("Error connecting to backend:", error);
        setIsConnected(false);
      }
    };

    connectToBackend();
  }, [isConnected]);

  // Add a new thread
  const addThread = useCallback(() => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: "New Thread",
      messages: [],
      isPinned: false,
    };
    setThreads((prev: any) => [...prev, newThread]);
    setCurrentThread(newThread.id);
    setEditingThreadTitle(newThread.id);
  }, []);

  // Edit thread title
  const editThreadTitle = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev: Thread[]) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, title: newTitle } : thread
      )
    );
  }, []);

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
          if (!parentId) {
            return { ...thread, messages: [...thread.messages, newMessage] };
          }
          const addReply = (messages: Message[]): Message[] => {
            return messages.map((message) => {
              if (message.id === parentId) {
                return {
                  ...message,
                  replies: [...message.replies, newMessage],
                };
              }
              return { ...message, replies: addReply(message.replies) };
            });
          };
          return { ...thread, messages: addReply(thread.messages) };
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
            return messages.reduce((acc: Message[], message) => {
              if (message.id === messageId) {
                return deleteChildren ? acc : [...acc, ...message.replies];
              }
              return [
                ...acc,
                { ...message, replies: removeMessage(message.replies) },
              ];
            }, []);
          };
          return { ...thread, messages: removeMessage(thread.messages) };
        })
      );
    },
    []
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

      setTimeout(() => {
        const newMessageElement = document.getElementById(
          `message-${newMessageId}`
        );
        if (newMessageElement) {
          newMessageElement.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }
      }, 100);
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
    const isSelected = selectedMessage === message.id;
    const isParentOfSelected =
      selectedMessage !== null &&
      findMessageById(message.replies, selectedMessage) !== null;
    const isSelectedOrParent =
      isSelected || isParentOfSelected || parentId === message.id;
    const indent = isSelectedOrParent ? 0 : depth * MESSAGE_INDENT;

    const getTotalReplies = (msg: Message): number => {
      return msg.replies.reduce(
        (total, reply) => total + 1 + getTotalReplies(reply),
        0
      );
    };
    const findMessageAndParent = (
      messages: Message[],
      targetId: string,
      parent: Message | null = null
    ): [Message | null, Message | null] => {
      for (const message of messages) {
        if (message.id === targetId) return [message, parent];
        const [found, foundParent] = findMessageAndParent(
          message.replies,
          targetId,
          message
        );
        if (found) return [found, foundParent];
      }
      return [null, null];
    };

    const getSiblings = (parent: Message | null): Message[] => {
      if (!parent) return currentThreadData?.messages || [];
      return parent.replies;
    };
    const totalReplies = getTotalReplies(message);

    const currentThreadData = threads.find((t) => t.id === currentThread);
    if (!currentThreadData) return null;

    const [currentMessage, parentMessage] = findMessageAndParent(
      currentThreadData.messages,
      message.id
    );
    if (!currentMessage) return null;

    const siblings = getSiblings(parentMessage);
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
              <div className="flex items-center justify-between pl-1">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 rounded-sm hover:bg-secondary bg-background border border-border"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(threadId, message.id);
                    }}
                  >
                    {message.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                        threads.find((t) => t.id === currentThread)?.messages || [],
                        parentId
                      )?.publisher
                      ? message.publisher === "ai"
                        ? message.modelName || "AI"
                        : "User"
                      : null}
                  </span>
                </div>
                {/* New navigation controls */}
                <div className={`flex space-x-1 ${isSelectedOrParent || isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity duration-200`}>
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
                        editingContent.split("\n").length * 20,
                        editingContent.length * 0.25
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
                  className="whitespace-normal break-words overflow-hidden pt-1 pl-1"
                  onDoubleClick={() => startEditingMessage(message)}
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
                    <div className="markdown-content font-serif">
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
                            const match = /language-(\w+)/.exec(
                              className || ""
                            );
                            return !inline && match ? (
                              <SyntaxHighlighter
                                PreTag={'pre'}
                                style={gruvboxDark}
                                language={match[1]}
                                showLineNumbers
                                wrapLines
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
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
            {!message.isCollapsed && selectedMessage === message.id && (
              <div className="space-x-2 flex flex-wrap items-center select-none">
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
                      onClick={() => addEmptyReply(threadId, message.id)}
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
                      onClick={() => startEditingMessage(message)}
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

  const handleModelChange = useCallback(
    (field: keyof Model, value: string | number) => {
      if (editingModel) {
        setEditingModel({ ...editingModel, [field]: value });
      }
    },
    [editingModel]
  );

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
      baseModel: "gpt-4o-mini",
      systemPrompt: "You are a helpful assistant.",
      temperature: 0.7,
      maxTokens: 1024,
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
    },
    [currentThread]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedMessage || !currentThread) return;

      const currentThreadData = threads.find((t) => t.id === currentThread);
      if (!currentThreadData) return;

      // Helper function to find a message and its parent in the thread
      const findMessageAndParent = (
        messages: Message[],
        targetId: string,
        parent: Message | null = null
      ): [Message | null, Message | null] => {
        for (const message of messages) {
          if (message.id === targetId) return [message, parent];
          const [found, foundParent] = findMessageAndParent(
            message.replies,
            targetId,
            message
          );
          if (found) return [found, foundParent];
        }
        return [null, null];
      };

      const [currentMessage, parentMessage] = findMessageAndParent(
        currentThreadData.messages,
        selectedMessage
      );
      if (!currentMessage) return;

      // Helper function to get sibling messages
      const getSiblings = (parent: Message | null): Message[] => {
        if (!parent) return currentThreadData.messages;
        return parent.replies;
      };

      switch (event.key) {
        case "ArrowLeft":
          // Select parent message
          if (parentMessage && editingMessage !== selectedMessage) {
            setSelectedMessage(parentMessage.id);
          }
          break;
        case "ArrowRight":
          // Select first child message
          if (
            currentMessage.replies.length > 0 &&
            editingMessage !== selectedMessage
          ) {
            setSelectedMessage(currentMessage.replies[0].id);
          }
          break;
        case "ArrowUp":
          // Select previous sibling
          if (editingMessage !== selectedMessage) {
            const siblings = getSiblings(parentMessage);
            const currentIndex = siblings.findIndex(
              (m) => m.id === currentMessage.id
            );
            if (currentIndex > 0) {
              setSelectedMessage(siblings[currentIndex - 1].id);
            }
          }
          break;
        case "ArrowDown":
          // Select next sibling
          if (editingMessage !== selectedMessage) {
            const nextSiblings = getSiblings(parentMessage);
            const nextIndex = nextSiblings.findIndex(
              (m) => m.id === currentMessage.id
            );
            if (nextIndex < nextSiblings.length - 1) {
              setSelectedMessage(nextSiblings[nextIndex + 1].id);
            }
          }
          break;
        case "r":
          if (event.altKey && editingMessage !== selectedMessage) {
            // Alt+R for replying to a message
            event.preventDefault();
            if (currentThread) {
              addEmptyReply(currentThread, selectedMessage);
            }
          }
          break;
        case "g":
          if (event.altKey && editingMessage !== selectedMessage) {
            // Alt+G for generating AI reply
            event.preventDefault();
            if (currentThread) {
              generateAIReply(currentThread, selectedMessage);
            }
          }
          break;
        case "Insert":
          // Insert for editing a message
          if (editingMessage !== selectedMessage) {
            const currentThreadData = threads.find(
              (t) => t.id === currentThread
            );
            if (currentThreadData) {
              const message = findMessageById(
                currentThreadData.messages,
                selectedMessage
              );
              if (message) {
                startEditingMessage(message);
              }
            }
          }
          break;
        case "Delete":
        case "Backspace":
          // Delete or Backspace for deleting a message
          if (currentThread && editingMessage !== selectedMessage) {
            if (event.shiftKey) {
              // Shift+Delete/Backspace to delete the message and its children
              deleteMessage(currentThread, selectedMessage, true);
            } else {
              // Regular Delete/Backspace to delete only the message
              deleteMessage(currentThread, selectedMessage, false);
            }
          }
          break;
        default:
          break;
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
    threads,
    generateAIReply,
    addEmptyReply,
    startEditingMessage,
    deleteMessage,
    findMessageById,
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
          onClick={() => setCurrentThread(null)}
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
        <ScrollArea className="flex-auto" onClick={() => setCurrentThread(null)}>
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
                          editThreadTitle(thread.id, e.target.value)
                        }
                        className="min-font-size flex-grow h-8 p-1 my-1"
                        onClick={(e) => e.stopPropagation()}
                        maxLength={64}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadTitle(null);
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          editThreadTitle(thread.id, thread.title); // Reset to original title
                          setEditingThreadTitle(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span
                        className="pl-1 flex-grow"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadTitle(thread.id);
                        }}
                      >
                        {thread.title}
                      </span>
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
        <div className="top-bar bg-gradient-to-b from-background/100 to-background/00">
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
            <span>  Alt+R                 ┃ Reply</span><br />
            <span>  Alt+G                 ┃ Generate AI reply</span><br />
            <span>  Insert/Double-click   ┃ Edit message</span><br />
            <span>  Enter                 ┃ Confirm edit</span><br />
            <span>  Escape                ┃ Cancel edit</span><br />
            <span>  Delete                ┃ Delete message</span><br />
            <span>  Shift+Delete          ┃ Delete with children</span>
          </p>
          <div className="mt-4 text-center text-sm text-muted-foreground font-serif">
            <span>Select a thread to view messages.</span><br />
            <a href="https://github.com/yijia-z/aide" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
            <span className="mx-2">|</span>
            <a href="mailto:z@zy-j.com" className="hover:underline">Contact</a>
          </div>
        </div>
        <div className="sm:hidden fixed bottom-20 left-0 right-0 p-4 text-center text-sm text-muted-foreground bg-background font-serif">
          <span>Select a thread to view messages.</span><br />
          <a href="https://github.com/yijia-z/aide" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
          <span className="mx-2">|</span>
          <a href="mailto:z@zy-j.com" className="hover:underline">Contact</a>
        </div>
      </div>
    );
  }

  // Render model configuration
  function renderModelConfig() {
    return (
      <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
        <div className="top-bar bg-gradient-to-b from-background/100 to-background/00">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
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
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold">{model.name}</h3>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingModel(model)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
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
                    <Input
                      className="min-font-size text-foreground"
                      value={editingModel?.baseModel}
                      onChange={(e) =>
                        handleModelChange("baseModel", e.target.value)
                      }
                    />
                    <Label>System Prompt</Label>
                    <Textarea
                      className="min-font-size text-foreground"
                      value={editingModel?.systemPrompt}
                      onChange={(e) =>
                        handleModelChange("systemPrompt", e.target.value)
                      }
                    />
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <Input
                        type="number"
                        value={editingModel?.temperature}
                        onChange={(e) =>
                          handleModelChange(
                            "temperature",
                            parseFloat(e.target.value)
                          )
                        }
                        className="min-font-size text-foreground w-15 h-6 text-left text-xs"
                        step="0.01"
                        min="0"
                        max="1"
                      />
                    </div>
                    {editingModel && (
                      <Slider
                        defaultValue={[0.7]}
                        max={1}
                        step={0.01}
                        value={[editingModel.temperature]}
                        onValueChange={(value) =>
                          handleModelChange("temperature", value[0])
                        }
                        className="h-4"
                      />
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={editingModel?.maxTokens}
                        onChange={(e) =>
                          handleModelChange(
                            "maxTokens",
                            parseInt(e.target.value)
                          )
                        }
                        className="min-font-size text-foreground w-15 h-6 text-left text-xs"
                        step="10"
                        min="1"
                        max="4096"
                      />
                    </div>
                    {editingModel && (
                      <Slider
                        defaultValue={[1024]}
                        max={4096}
                        step={10}
                        value={[editingModel.maxTokens]}
                        onValueChange={(value) =>
                          handleModelChange("maxTokens", value[0])
                        }
                        className="h-4"
                      />
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <div className="space-x-2">
                        <Button size="icon" onClick={saveModelChanges}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditingModel(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteModel(model.id)}
                        disabled={models.length === 1}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p>Base Model: {model.baseModel}</p>
                    <p>Temperature: {model.temperature}</p>
                    <p>Max Tokens: {model.maxTokens}</p>
                  </div>
                )}
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
            bg-background/30 
            backdrop-blur-[5px] 
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
              className="w-full h-full flex flex-col"
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
