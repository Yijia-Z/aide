import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Edit,
  Trash,
  Trash2,
  MessageSquareReply,
  X,
  Check,
  Copy,
  Scissors,
  ClipboardPaste,
  WandSparkles,
  OctagonX,
  LoaderCircle,
  Plus,
  Minus,
  MessageSquareOff,
  ClipboardType,
  ClipboardCheck,
  ClipboardX,
  Box,
  Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Message, Thread, Tool } from "@/components/types";

interface RenderMessageProps {
  message: Message;
  threadId: string;
  depth?: number;
  parentId?: string | null;
  threads: Thread[];
  currentThread: string | null;
  selectedMessages: { [key: string]: string | null };
  editingMessage: string | null;
  editingContent: string;
  glowingMessageId: string | null;
  copiedStates: { [key: string]: boolean };
  clipboardMessage: {
    message: Message;
    operation: "copy" | "cut";
    sourceThreadId: string | null;
    originalMessageId: string | null;
  } | null;
  isGenerating: { [key: string]: boolean };
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  toggleCollapse: (threadId: string, messageId: string) => void;
  setGlowingMessageId: (id: string | null) => void;
  setEditingContent: (content: string) => void;
  confirmEditingMessage: (threadId: string, messageId: string) => void;
  cancelEditingMessage: () => void;
  startEditingMessage: (message: Message) => void;
  addEmptyReply: (threadId: string, parentId: string | null) => void;
  generateAIReply: (threadId: string, messageId: string, count: number) => void;
  copyOrCutMessage: (
    threadId: string,
    messageId: string,
    operation: "copy" | "cut"
  ) => void;
  pasteMessage: (threadId: string, parentId: string | null) => void;
  deleteMessage: (
    threadId: string,
    messageId: string,
    deleteChildren: boolean | "clear"
  ) => void;
  findMessageById: (messages: Message[], id: string) => Message | null;
  findMessageAndParents: (
    messages: Message[],
    targetId: string,
    parents?: Message[]
  ) => [Message | null, Message[]];
  getSiblings: (messages: Message[], messageId: string) => Message[];
  getModelDetails: (modelId: string | undefined) => any;
  setCopiedStates: React.Dispatch<
    React.SetStateAction<{ [key: string]: boolean }>
  >;
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  setClipboardMessage: React.Dispatch<
    React.SetStateAction<{
      message: Message;
      operation: "copy" | "cut";
      sourceThreadId: string | null;
      originalMessageId: string | null;
    } | null>
  >;
  lastGenerateCount: number;
  setLastGenerateCount: React.Dispatch<React.SetStateAction<number>>;
}

const RenderMessage: React.FC<RenderMessageProps> = ({
  message,
  threadId,
  depth = 0,
  parentId = null,
  threads,
  currentThread,
  selectedMessages,
  editingMessage,
  editingContent,
  glowingMessageId,
  copiedStates,
  clipboardMessage,
  isGenerating,
  setSelectedMessages,
  toggleCollapse,
  setGlowingMessageId,
  setEditingContent,
  confirmEditingMessage,
  cancelEditingMessage,
  startEditingMessage,
  addEmptyReply,
  generateAIReply,
  copyOrCutMessage,
  pasteMessage,
  deleteMessage,
  findMessageById,
  findMessageAndParents,
  getSiblings,
  getModelDetails,
  setCopiedStates,
  setThreads,
  setClipboardMessage,
  lastGenerateCount,
  setLastGenerateCount,
}) => {
  // Message selection and hierarchy
  const selectedMessage = currentThread !== null ? selectedMessages[currentThread] : null;
  const isSelected = selectedMessage === message.id;
  const isParentOfSelected =
    selectedMessage !== null &&
    findMessageById(message.replies, selectedMessage) !== null;
  const isSelectedOrParent =
    isSelected || isParentOfSelected || parentId === message.id;

  const [ref, inView] = useInView({
    threshold: 0,
    rootMargin: "200px 0px", // Pre-load when within 200px of viewport
  });

  // Cache rendered content
  const renderedContentRef = useRef<string | null>(null);

  // Memoize the markdown content
  useEffect(() => {
    if (inView && !renderedContentRef.current) {
      renderedContentRef.current = message.content;
    }
  }, [inView, message.content]);

  // Helper functions
  const getTotalReplies = (msg: Message): number => {
    return msg.replies.reduce(
      (total, reply) => total + 1 + getTotalReplies(reply),
      0
    );
  };

  const handleCopy = (codeString: string, codeBlockId: string) => {
    navigator.clipboard.writeText(codeString);
    setCopiedStates((prev) => ({ ...prev, [codeBlockId]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [codeBlockId]: false }));
    }, 2000);
  };

  const updateMessageModelConfig = (
    messages: Message[],
    targetId: string,
    newModelName: string
  ): Message[] => {
    return messages.map((message) => {
      if (message.id === targetId) {
        return {
          ...message,
          modelConfig: { ...message.modelConfig, name: newModelName },
        };
      }
      if (message.replies.length > 0) {
        return {
          ...message,
          replies: updateMessageModelConfig(
            message.replies,
            targetId,
            newModelName
          ),
        };
      }
      return message;
    });
  };

  // Thread and message data
  const currentThreadData = threads.find((t) => t.id === currentThread);
  if (!currentThreadData) return null;

  const [currentMessage, parentMessages] = findMessageAndParents(
    currentThreadData.messages,
    message.id
  );
  const parentMessage =
    parentMessages.length > 0
      ? parentMessages[parentMessages.length - 1]
      : null;
  const siblings = getSiblings(currentThreadData.messages, message.id);
  const currentIndex = siblings.findIndex((m) => m.id === message.id);
  const truncateContent = (content: string, isSelected: boolean) => {
    // Don't truncate if selected or parent of selected
    if (isSelected || isParentOfSelected) return content;

    const maxLength = 500;
    const lines = content.split('\n');
    const firstFourLines = lines.slice(0, 4).join('\n');

    if (content.length > maxLength || lines.length > 3) {
      return `${firstFourLines.slice(0, maxLength)
        }${lines[3]?.startsWith('```') || lines[3]?.startsWith('$$')
          ? '\n'
          : ''
        }${lines.length > 4
          ? '...'
          : content.length > maxLength
            ? '...'
            : ''
        }`;
    }
    return content;
  };

  // Additional data
  const totalReplies = getTotalReplies(message);
  const modelDetails = message.modelConfig;
  const modelName = getModelDetails(message.modelId)?.name;
  if (modelName && modelDetails && modelName !== modelDetails.name) {
    // Update the original message's modelConfig name only
    setThreads((prevThreads) =>
      prevThreads.map((thread) => ({
        ...thread,
        messages: updateMessageModelConfig(
          thread.messages,
          message.id,
          modelName
        ),
      }))
    );
  }

  // Indentation
  const indent = depth === 0 ? 0 : (isSelectedOrParent || (siblings.some(s => s.id === selectedMessage))) ? -16 : 0;

  return (
    <motion.div
      ref={ref}
      key={message.id}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={"mt-2"}
      style={{ marginLeft: `${indent}px` }}
      layout={"position"}
      id={`message-${message.id}`}
    >
      <ContextMenu>
        <ContextMenuTrigger
          disabled={editingMessage === message.id}
          onContextMenu={(e) => {
            if (currentThread) {
              setSelectedMessages((prev) => ({ ...prev, [currentThread]: message.id }));
            }
          }}
        >
          <div
            className={cn(
              "flex items-start space-x-1 px-1 pt-1 rounded-lg",
              isSelectedOrParent ? "custom-shadow" : "text-muted-foreground",
              siblings.some(s => s.id === selectedMessage) && "border-2",
              !selectedMessage && parentId === null && "border-2",
              glowingMessageId === message.id && "glow-effect"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (currentThread) {
                setSelectedMessages((prev) => ({ ...prev, [currentThread]: message.id }));
              }
            }}
          >
            <div className="flex-grow p-0 overflow-hidden">
              <div className="flex flex-col">
                <div className={`flex items-center justify-between rounded-md ${isGenerating[message.id] ? "opacity-50 glow-effect" : ""}`}>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      className="w-6 h-6 p-0 rounded-md relative"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(threadId, message.id);
                      }}
                    >
                      {message.isCollapsed ? <Plus /> : <Minus />}
                    </Button>
                    <span
                      className={`font-bold truncate select-none ${message.publisher === "ai"
                        ? "text-blue-800 dark:text-blue-600"
                        : "text-green-800 dark:text-green-600"
                        }`}
                    >
                      {parentId === null ||
                        message.publisher !==
                        findMessageById(
                          threads.find((t) => t.id === currentThread)
                            ?.messages || [],
                          parentId
                        )?.publisher
                        ? message.publisher === "ai"
                          ? modelDetails?.name || "AI"
                          : "User"
                        : null}
                    </span>
                    {modelDetails && (
                      <div className="flex items-center space-x-1">
                        <Badge variant="outline" className="select-none">
                          <Bot className="w-3 h-3 mr-1" />
                          {modelDetails.baseModel
                            ?.split("/")
                            .pop()
                            ?.split("-")[0]}
                        </Badge>
                        {modelDetails.parameters?.tools && modelDetails.parameters.tools.length > 0 && modelDetails.parameters.tool_choice !== "none" && (
                          <div className="flex gap-1">
                            {modelDetails.parameters.tools.map((tool: Tool) => (
                              <Badge key={tool.id} variant={modelDetails?.parameters?.tool_choice === "auto" ? "outline" : "secondary"} className="select-none">
                                <Box className="w-3 h-3 mr-1" />
                                {tool.function.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={`flex space-x-1 ${isSelected
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
                          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: parentMessage.id }));
                        }}
                        onMouseEnter={() =>
                          setGlowingMessageId(parentMessage.id)
                        }
                        onMouseLeave={() => setGlowingMessageId(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    {currentMessage?.replies &&
                      currentMessage.replies.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-6 h-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: currentMessage.replies[0].id }));
                          }}
                          onMouseEnter={() =>
                            setGlowingMessageId(currentMessage.replies[0].id)
                          }
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
                          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: siblings[currentIndex - 1].id }));
                        }}
                        onMouseEnter={() =>
                          setGlowingMessageId(siblings[currentIndex - 1].id)
                        }
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
                          setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: siblings[currentIndex + 1].id }));
                        }}
                        onMouseEnter={() =>
                          setGlowingMessageId(siblings[currentIndex + 1].id)
                        }
                        onMouseLeave={() => setGlowingMessageId(null)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {editingMessage === message.id ? (
                  <Textarea
                    id={`message-edit-${message.id}`}
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="min-font-size font-serif flex-grow w-auto m-1 p-0 bg-inherit"
                    style={{
                      minHeight: Math.min(
                        Math.max(
                          20,
                          editingContent.split("\n").length *
                          (window.innerWidth < 480
                            ? 35
                            : window.innerWidth < 640
                              ? 30
                              : window.innerWidth < 1024
                                ? 25
                                : 20),
                          editingContent.length *
                          (window.innerWidth < 480
                            ? 0.6
                            : window.innerWidth < 640
                              ? 0.5
                              : window.innerWidth < 1024
                                ? 0.35
                                : 0.25)
                        ),
                        window.innerHeight * 0.5
                      ),
                      maxHeight: "50vh",
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    className={`whitespace-normal break-words markdown-content font-serif overflow-hidden pt-0.5 px-1 ${!selectedMessage && parentId === null || isSelectedOrParent || (siblings.some(s => s.id === selectedMessage)) ? '' : message.replies.length > 0 ? `${message.isCollapsed ? 'border-l-2 border-dotted' : 'border-l-2'} mt-[2.25px] mx-3` : ''}`}
                    onDoubleClick={() => {
                      cancelEditingMessage();
                      startEditingMessage(message);
                    }}
                  >
                    {message.isCollapsed ? (
                      <div className="flex flex-col">
                        <div>
                          {`${message.content
                            .split("\n")[0]
                            .slice(0, 50)}${message.content.length > 50 ? "..." : ""
                            }`}
                        </div>
                        {totalReplies > 0 && (
                          <span className="dark:text-yellow-600 text-yellow-800">
                            {`(${totalReplies} ${totalReplies === 1 ? "reply" : "replies"})`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="markdown-content">
                        <Markdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          components={{
                            code({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }: any) {
                              const match =
                                /language-(\w+)/.exec(className || "");
                              const codeString = String(children).replace(
                                /\n$/,
                                ""
                              );
                              // Create a unique ID for each code block within the message
                              const codeBlockId = `${message.id}-${match?.[1] || "unknown"
                                }-${codeString.slice(0, 32)}`;
                              return !inline && match ? (
                                <div className="relative">
                                  <div className="absolute -top-7 w-full flex justify-between items-center p-1 pl-3 rounded-t-lg border-b-[1.5px] text-[14px] font-[Consolas] border-[#A8998480]  bg-[#1D2021] text-[#A89984]">
                                    <span>{match[1]}</span>
                                    <Button
                                      className="rounded-md w-6 h-6 p-0"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleCopy(codeString, codeBlockId)
                                      }
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
                                    wrapLines
                                    showLineNumbers
                                    lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }}
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
                          {message.content ? truncateContent(message.content, isSelected) : "(empty)"}
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
                          if (message.isCollapsed) {
                            toggleCollapse(threadId, message.id);
                          }
                          cancelEditingMessage();
                          setSelectedMessages((prev) => ({ ...prev, [String(threadId)]: null }));
                          addEmptyReply(threadId, message.id);
                        }}
                      >
                        <MessageSquareReply className="h-4 w-4" />
                        <span className="hidden md:inline ml-2">
                          Reply
                        </span>
                      </Button>
                      {isGenerating[message.id] ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "h-10 w-inherit relative group",
                            "hover:text-destructive-foreground hover:bg-destructive transition-scale-zoom"
                          )}
                          onClick={() =>
                            generateAIReply(threadId, message.id, 1)
                          }
                        >
                          <span className="group-hover:hidden">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          </span>
                          <span className="hidden group-hover:inline">
                            <OctagonX className="h-4 w-4" />
                          </span>
                          <span className="hidden md:inline ml-2 w-[59px]">
                            <span className="group-hover:hidden">
                              Working
                            </span>
                            <span className="hidden group-hover:inline">
                              Stop
                            </span>
                          </span>
                        </Button>
                      ) : (
                        <Menubar className="p-0 border-none bg-transparent">
                          <MenubarMenu>
                            <MenubarTrigger
                              className="h-10 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition-scale-zoom"
                            >
                              <WandSparkles className="h-4 w-4" />
                              <span className="hidden md:inline ml-2">
                                Generate
                              </span>
                            </MenubarTrigger>
                            <MenubarContent className="custom-shadow">
                              <MenubarItem
                                onClick={() => {
                                  if (message.isCollapsed) {
                                    toggleCollapse(threadId, message.id);
                                  }
                                  generateAIReply(threadId, message.id, 1);
                                }}
                              >
                                Once
                                <span className="hidden md:inline ml-auto">
                                  <MenubarShortcut>Enter</MenubarShortcut>
                                </span>
                              </MenubarItem>
                              <MenubarItem
                                onClick={() => {
                                  if (message.isCollapsed) {
                                    toggleCollapse(threadId, message.id);
                                  }
                                  generateAIReply(threadId, message.id, lastGenerateCount);
                                }}
                              >
                                {lastGenerateCount} times
                                <MenubarShortcut>{lastGenerateCount}×</MenubarShortcut>
                              </MenubarItem>

                              <MenubarItem
                                onClick={() => {
                                  if (message.isCollapsed) {
                                    toggleCollapse(threadId, message.id);
                                  }
                                  const times = prompt(
                                    "How many times do you want to generate? Type between 1-10",
                                    lastGenerateCount.toString()
                                  );
                                  const numTimes = parseInt(times || "0", 10);
                                  if (!isNaN(numTimes) && numTimes > 0 && numTimes <= 10) {
                                    setLastGenerateCount(numTimes);
                                    generateAIReply(threadId, message.id, numTimes);
                                  } else if (numTimes > 10) {
                                    setLastGenerateCount(10);
                                    generateAIReply(threadId, message.id, 10);
                                  }
                                }}
                              >
                                Custom
                              </MenubarItem>                            </MenubarContent>
                          </MenubarMenu>
                        </Menubar>
                      )}
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
                        <span className="hidden md:inline ml-2">
                          Edit
                        </span>
                      </Button>
                      <Menubar className="p-0 border-none bg-transparent">
                        <MenubarMenu>
                          <MenubarTrigger
                            className="h-10 rounded-lg hover:bg-background transition-scale-zoom"
                          >
                            {clipboardMessage ? (
                              <ClipboardCheck className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            <span className="hidden md:inline ml-2">
                              {clipboardMessage?.operation === "cut" ? "Cutting" : clipboardMessage ? "Copying" : "Copy"}
                            </span>
                          </MenubarTrigger>
                          <MenubarContent className="custom-shadow">
                            {clipboardMessage ? (
                              <>
                                <MenubarItem
                                  onClick={() =>
                                    pasteMessage(threadId, message.id)
                                  }
                                >
                                  Paste Message
                                  <span className="hidden md:inline ml-auto">
                                    <MenubarShortcut>⌘ V</MenubarShortcut>
                                  </span>
                                </MenubarItem>
                                <MenubarItem
                                  onClick={() => {
                                    setClipboardMessage(null);
                                    setGlowingMessageId(null);
                                  }}
                                >
                                  Clear Clipboard
                                  <span className="hidden md:inline ml-auto">
                                    <MenubarShortcut>Esc</MenubarShortcut>
                                  </span>
                                </MenubarItem>
                              </>
                            ) : (
                              <>
                                <MenubarItem
                                  onClick={() =>
                                    copyOrCutMessage(
                                      threadId,
                                      message.id,
                                      "copy"
                                    )
                                  }
                                >
                                  Copy
                                  <span className="hidden md:inline ml-auto">
                                    <MenubarShortcut>⌘ C</MenubarShortcut>
                                  </span>
                                </MenubarItem>
                                <MenubarItem
                                  onClick={() =>
                                    copyOrCutMessage(
                                      threadId,
                                      message.id,
                                      "cut"
                                    )
                                  }
                                >
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
                          <MenubarTrigger className="h-10 rounded-lg hover:bg-destructive transition-scale-zoom">
                            <Trash className="h-4 w-4" />
                            <span className="hidden md:inline ml-2">Delete</span>
                          </MenubarTrigger>
                          <MenubarContent className="custom-shadow">
                            {message.replies && message.replies.length > 0 ? (
                              <>
                                <MenubarItem onClick={() => deleteMessage(threadId, message.id, false)}>
                                  Keep Replies
                                  <MenubarShortcut className="hidden md:inline">⌫</MenubarShortcut>
                                </MenubarItem>
                                <MenubarItem onClick={() => deleteMessage(threadId, message.id, true)}>
                                  With Replies
                                  <MenubarShortcut className="hidden md:inline">⌘ ⌫</MenubarShortcut>
                                </MenubarItem>
                                <MenubarItem onClick={() => deleteMessage(threadId, message.id, 'clear')}>
                                  Only Replies
                                  <MenubarShortcut className="hidden md:inline">⌥ ⌫</MenubarShortcut>
                                </MenubarItem>
                              </>
                            ) : (
                              <MenubarItem onClick={() => deleteMessage(threadId, message.id, false)}>
                                Delete
                                <MenubarShortcut className="hidden md:inline">⌫</MenubarShortcut>
                              </MenubarItem>
                            )}
                          </MenubarContent>
                        </MenubarMenu>
                      </Menubar>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="custom-shadow bg-background/90">
          <ContextMenuItem
            onClick={() => {
              if (message.isCollapsed) {
                toggleCollapse(threadId, message.id);
              }
              addEmptyReply(threadId, message.id);
            }}
          >
            <MessageSquareReply className="h-4 w-4 mr-2" />
            Reply
            <ContextMenuShortcut className="hidden md:inline">R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              if (message.isCollapsed) {
                toggleCollapse(threadId, message.id);
              }
              generateAIReply(threadId, message.id, 1);
            }}
          >
            <WandSparkles className="h-4 w-4 mr-2" />
            Generate
            <ContextMenuShortcut className="hidden md:inline">Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              cancelEditingMessage();
              startEditingMessage(message);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
            <ContextMenuShortcut className="hidden md:inline">E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              copyOrCutMessage(threadId, message.id, "copy")
            }
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
            <ContextMenuShortcut className="hidden md:inline">⌘ C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              copyOrCutMessage(threadId, message.id, "cut")
            }
          >
            <Scissors className="h-4 w-4 mr-2" />
            Cut
            <ContextMenuShortcut className="hidden md:inline">⌘ X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              pasteMessage(threadId, message.id)
              setClipboardMessage(null)
            }}
          >
            {clipboardMessage ? (
              <ClipboardPaste className="mr-2 h-4 w-4" />
            ) : (
              <ClipboardType className="mr-2 h-4 w-4" />
            )}
            <span>{clipboardMessage ? "Paste Message" : "Paste Clipboard"}</span>
            <ContextMenuShortcut className="hidden md:inline ml-2">⌘ V</ContextMenuShortcut>
          </ContextMenuItem>
          {clipboardMessage && (
            <ContextMenuItem
              onClick={() => {
                setClipboardMessage(null);
                setGlowingMessageId(null);
              }}
            >
              <ClipboardX className="mr-2 h-4 w-4" />
              <span>Clear {clipboardMessage?.operation === "cut" ? "Cut" : "Copied"}</span>
              <ContextMenuShortcut className="hidden md:inline">Esc</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuLabel>Delete</ContextMenuLabel>
          <ContextMenuItem
            className="text-red-500"
            onClick={() => deleteMessage(threadId, message.id, false)}
          >
            <Trash className="h-4 w-4 mr-2" />
            Keep Replies
            <ContextMenuShortcut className="hidden md:inline">⌫</ContextMenuShortcut>
          </ContextMenuItem>
          {message.replies?.length > 0 && (
            <>
              <ContextMenuItem
                className="text-red-500"
                onClick={() => deleteMessage(threadId, message.id, true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                With Replies
                <ContextMenuShortcut className="hidden md:inline">⌘ ⌫</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                className="text-red-500"
                onClick={() => deleteMessage(threadId, message.id, 'clear')}
              >
                <MessageSquareOff className="h-4 w-4 mr-2" />
                Only Replies
                <ContextMenuShortcut className="hidden md:inline">⌥ ⌫</ContextMenuShortcut>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <AnimatePresence>
        {!message.isCollapsed && (
          <motion.div
            transition={{ duration: 0.1 }}
            layout={"position"}
          >
            {message.replies.map((reply) => (
              <div
                key={reply.id}
                className={cn(
                  "ml-4",
                  !isParentOfSelected && cn(
                    "relative",
                    // Add connecting line from parent to child
                    "before:absolute before:left-0 before:-top-2 before:w-4 before:h-10",
                    "before:border-b-2 before:border-l-2 before:border-border before:rounded-bl-lg",
                    // Add vertical line for non-last replies
                    getSiblings(message.replies, reply.id).slice(-1)[0].id !== reply.id &&
                    "after:absolute after:left-0 after:top-3 after:bottom-0 after:border-l-2 after:border-border"
                  )
                )}
              >
                <RenderMessage
                  key={reply.id}
                  message={reply}
                  threadId={threadId}
                  depth={depth + 1}
                  parentId={message.id}
                  threads={threads}
                  currentThread={currentThread}
                  selectedMessages={selectedMessages}
                  editingMessage={editingMessage}
                  editingContent={editingContent}
                  glowingMessageId={glowingMessageId}
                  copiedStates={copiedStates}
                  clipboardMessage={clipboardMessage}
                  isGenerating={isGenerating}
                  setSelectedMessages={setSelectedMessages}
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
                  lastGenerateCount={lastGenerateCount}
                  setLastGenerateCount={setLastGenerateCount}
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RenderMessage;
