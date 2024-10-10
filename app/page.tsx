'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChevronDown, ChevronRight, Edit, Trash, ListPlus, MessageSquare, X, Plus, Check, MessageSquarePlus, Pin, PinOff, Menu, Send, Sparkle } from 'lucide-react'
import { useMediaQuery } from 'usehooks-ts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"


const MESSAGE_INDENT = 8; // Constant value for indentation

interface Message {
  id: string
  content: string
  publisher: 'user' | 'ai'
  modelName?: string
  replies: Message[]
  isCollapsed: boolean
}

interface Thread {
  id: string
  title: string
  messages: Message[]
  isPinned: boolean
}

interface Model {
  id: string
  name: string
  baseModel: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

function findAllParentMessages(threads: Thread[], currentThreadId: string | null, replyingToId: string | null): Message[] {
  if (!currentThreadId || !replyingToId) return [];

  const currentThread = threads.find(thread => thread.id === currentThreadId);
  if (!currentThread) return [];

  function findMessageAndParents(messages: Message[], targetId: string, parents: Message[] = []): Message[] | null {
    for (const message of messages) {
      if (message.id === targetId) {
        return [...parents, message];
      }
      const found = findMessageAndParents(message.replies, targetId, [...parents, message]);
      if (found) return found;
    }
    return null;
  }

  const parentMessages = findMessageAndParents(currentThread.messages, replyingToId);
  return parentMessages ? parentMessages.slice(0, -1) : [];
}
const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
console.log('API Base URL:', apiBaseUrl);
async function generateAIResponse(prompt: string, model: Model, threads: Thread[], currentThread: string | null, replyingTo: string | null) {
  const response = await fetch(apiBaseUrl ? `${apiBaseUrl}/api/chat` : '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: model.systemPrompt },
        ...prompt.split('\n').map(line => ({ role: 'user', content: line })),
        ...findAllParentMessages(threads, currentThread, replyingTo).map(msg => ({
          role: msg.publisher === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: prompt }
      ],
      configuration: { model: model.baseModel, temperature: model.temperature, max_tokens: model.maxTokens },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate AI response')
  }

  const data = await response.json()
  console.log(data);
  return apiBaseUrl ? data.response : data.choices[0].message.content
}

export default function ThreadedDocument() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThread, setCurrentThread] = useState<string | null>(null)
  const [models, setModels] = useState<Model[]>([
    { id: '1', name: 'Default Model', baseModel: 'gpt-4o-mini', systemPrompt: 'You are a helpful assistant.', temperature: 0.7, maxTokens: 512 }
  ])
  const [selectedModel, setSelectedModel] = useState<string>(models[0].id)
  const [newMessageContent, setNewMessageContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  // const [selectedThreads, setSelectedThreads] = useState<string[]>([])
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'threads' | 'messages' | 'models'>('messages')
  const isMobile = useMediaQuery("(max-width: 768px)")

  const replyBoxRef = useRef<HTMLDivElement>(null)
  const threadTitleInputRef = useRef<HTMLInputElement>(null)
  // const newMessageInputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const connectToBackend = async () => {
      try {
        const response = await fetch(isConnected ? `${apiBaseUrl}/api/connect` : '/api/connect', { method: 'GET' });
        if (response.ok) {
          console.log("connect to back！");
          setIsConnected(true);
        } else {
          console.error("fail。");
          setIsConnected(false);
        }
      } catch (error) {
        console.error("error:", error);
        setIsConnected(false);
      }
    };

    connectToBackend();  // Call the connection function when the component loads
  }, []);  // Empty dependency array, ensures it only executes once when the component first loads

  useEffect(() => {
    if (replyBoxRef.current) {
      replyBoxRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [replyingTo])

  useEffect(() => {
    if (selectedMessage) {
      const messageElement = document.getElementById(`message-${selectedMessage}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [selectedMessage]);


  useEffect(() => {
    if (editingThreadTitle && threadTitleInputRef.current) {
      threadTitleInputRef.current.focus()
    }
  }, [editingThreadTitle])

  const addThread = useCallback(() => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: 'New Thread',
      messages: [],
      isPinned: false
    }
    setThreads((prev: any) => [...prev, newThread])
    setCurrentThread(newThread.id)
    setEditingThreadTitle(newThread.id) // Set editingThreadTitle to the new thread's ID
  }, [])

  const addMessage = useCallback((threadId: string, parentId: string | null, content: string, publisher: 'user' | 'ai', newMessageId?: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread;
      const model = models.find(m => m.id === selectedModel);
      const newMessage: Message = {
        id: newMessageId || Date.now().toString(),
        content,
        publisher,
        modelName: publisher === 'ai' ? model?.name : undefined,
        replies: [],
        isCollapsed: false
      };
      setSelectedMessage(newMessage.id);
      if (!parentId) {
        return { ...thread, messages: [...thread.messages, newMessage] }
      }
      const addReply = (messages: Message[]): Message[] => {
        return messages.map(message => {
          if (message.id === parentId) {
            return { ...message, replies: [...message.replies, newMessage] }
          }
          return { ...message, replies: addReply(message.replies) }
        })
      }
      return { ...thread, messages: addReply(thread.messages) }
    }))
  }, [models, selectedModel])  // Add models and selectedModel to the dependency array

  const toggleCollapse = useCallback((threadId: string, messageId: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread;
      const toggleMessage = (messages: Message[]): Message[] => {
        return messages.map(message => {
          if (message.id === messageId) {
            return { ...message, isCollapsed: !message.isCollapsed }
          }
          return { ...message, replies: toggleMessage(message.replies) }
        })
      }
      return { ...thread, messages: toggleMessage(thread.messages) }
    }))
  }, [])

  const deleteMessage = useCallback((threadId: string, messageId: string, deleteChildren: boolean) => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread
      const removeMessage = (messages: Message[]): Message[] => {
        return messages.reduce((acc: Message[], message) => {
          if (message.id === messageId) {
            // If deleteChildren is false, add the message's replies to the accumulator
            return deleteChildren ? acc : [...acc, ...message.replies];
          }
          // Otherwise, keep the message and recursively process its replies
          return [...acc, { ...message, replies: removeMessage(message.replies) }];
        }, []);
      }
      return { ...thread, messages: removeMessage(thread.messages) }
    }))
  }, [])

  const editThreadTitle = useCallback((threadId: string, newTitle: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) =>
      thread.id === threadId ? { ...thread, title: newTitle } : thread
    ))
  }, [])

  const startEditingMessage = useCallback((message: Message) => {
    setEditingMessage(message.id)
    setEditingContent(message.content)
  }, [])

  const cancelEditingMessage = useCallback(() => {
    setEditingMessage(null)
    setEditingContent('')
  }, [])

  const confirmEditingMessage = useCallback((threadId: string, messageId: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread
      const editMessage = (messages: Message[]): Message[] => {
        return messages.map(message => {
          if (message.id === messageId) {
            return { ...message, content: editingContent }
          }
          return { ...message, replies: editMessage(message.replies) }
        })
      }
      return { ...thread, messages: editMessage(thread.messages) }
    }))
    setEditingMessage(null)
    setEditingContent('')
  }, [editingContent])

  const generateAIReply = useCallback(async (threadId: string, messageId: string, count: number = 1) => {
    const thread = threads.find((t: { id: string }) => t.id === threadId)
    if (!thread) return

    const message = findMessageById(thread.messages, messageId)
    if (!message) return

    setIsGenerating(true)
    try {
      const model = models.find((m: { id: any }) => m.id === selectedModel) || models[0]
      for (let i = 0; i < count; i++) {
        const aiResponse = await generateAIResponse(message.content, model, threads, threadId, messageId)
        addMessage(threadId, messageId, aiResponse, 'ai')
      }
    } catch (error) {
      console.error('Failed to generate AI response:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [threads, models, selectedModel, addMessage])

  const addEmptyReply = useCallback((threadId: string, parentId: string | null) => {
    const newMessageId = Date.now().toString();
    addMessage(threadId, parentId, '', 'user', newMessageId);

    // Start editing the new message immediately
    startEditingMessage({
      id: newMessageId,
      content: '',
      publisher: 'user',
      replies: [],
      isCollapsed: false
    });

    setTimeout(() => {
      const newMessageElement = document.getElementById(`message-${newMessageId}`);
      if (newMessageElement) {
        newMessageElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, [addMessage, startEditingMessage]);

  function renderMessage(message: Message, threadId: string, depth = 0, parentId: string | null = null) {
    const isSelected = selectedMessage === message.id;
    const isParentOfSelected = selectedMessage !== null && findMessageById(message.replies, selectedMessage) !== null;
    const isSelectedOrParent = isSelected || isParentOfSelected || parentId === message.id;
    const indent = isSelectedOrParent ? 0 : depth * MESSAGE_INDENT;

    const getTotalReplies = (msg: Message): number => {
      return msg.replies.reduce((total, reply) => total + 1 + getTotalReplies(reply), 0);
    };

    const totalReplies = getTotalReplies(message);

    return (
      <div key={message.id} className="mt-2" style={{ marginLeft: `${indent}px` }} id={`message-${message.id}`}>
        <div
          className={`flex items-start space-x-1 p-2 rounded hover:bg-gray-100 ${isSelectedOrParent ? 'bg-gray-200' : ''}`}
          onClick={() => setSelectedMessage(message.id)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-3 h-3 p-0 min-w-3"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(threadId, message.id);
            }}
          >
            {message.isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <div className="flex-grow overflow-hidden">
            <div className="flex flex-col p-1">
              <span className={`font-bold ${message.publisher === 'ai' ? 'text-blue-600' : 'text-green-600'}`}>
                {(parentId === null || message.publisher !== findMessageById(threads.find(t => t.id === currentThread)?.messages || [], parentId)?.publisher)
                  ? (message.publisher === 'ai' ? message.modelName || 'AI' : 'User')
                  : null}
              </span>
              {editingMessage === message.id ? (
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="min-font-size flex-grow mt-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      confirmEditingMessage(threadId, message.id);
                    } else if (e.key === 'Escape') {
                      cancelEditingMessage();
                    }
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap break-words overflow-hidden mt-1">
                  {message.isCollapsed
                    ? `${message.content.split('\n')[0].slice(0, 50)}${message.content.length > 50 ? '...' : ''}${totalReplies > 0 ? ` (${totalReplies} ${totalReplies === 1 ? 'reply' : 'replies'})` : ''}`
                    : <div className="markdown-content">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  }
                </div>)}
            </div>
            {!message.isCollapsed && selectedMessage === message.id && (
              <div className="mt-2 space-x-2 flex flex-wrap items-center">
                {editingMessage === message.id ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => confirmEditingMessage(threadId, message.id)}>
                      <Check className="h-4 w-4" />
                      {!isMobile && <MenubarShortcut>Ctrl + ↵</MenubarShortcut>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditingMessage}>
                      <X className="h-4 w-4" />
                      {!isMobile && <MenubarShortcut>Esc</MenubarShortcut>}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => addEmptyReply(threadId, message.id)}>
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Reply</span>
                    </Button>
                    <Menubar className="bg-transparent">
                      <MenubarMenu>
                        <MenubarTrigger className="bg-transparent">
                          <Sparkle className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Generate</span>
                        </MenubarTrigger>
                        <MenubarContent>
                          <MenubarItem onClick={() => generateAIReply(threadId, message.id, 1)}>
                            Once
                            {!isMobile && <MenubarShortcut>⎇G</MenubarShortcut>}
                          </MenubarItem>
                          <MenubarItem onClick={() => generateAIReply(threadId, message.id, 3)}>
                            Thrice
                          </MenubarItem>
                          <MenubarItem onClick={() => {
                            const times = prompt('How many times do you want to generate?', '5');
                            const numTimes = parseInt(times || '1', 10);
                            if (!isNaN(numTimes) && numTimes > 0) {
                              generateAIReply(threadId, message.id, numTimes);
                            }
                          }}>
                            Custom
                          </MenubarItem>
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>
                    <Button size="sm" variant="ghost" onClick={() => startEditingMessage(message)}>
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Edit</span>
                    </Button>
                    <Menubar className="bg-transparent">
                      <MenubarMenu>
                        <MenubarTrigger className="bg-transparent">
                          <Trash className="h-4 w-4" />
                          <span className="hidden sm:inline ml-2">Delete</span>
                        </MenubarTrigger>
                        <MenubarContent>
                          <MenubarItem onClick={() => deleteMessage(threadId, message.id, false)}>
                            Keep Children
                            {!isMobile && <MenubarShortcut>⌦</MenubarShortcut>}
                          </MenubarItem>
                          <MenubarItem onClick={() => deleteMessage(threadId, message.id, true)}>
                            With Children
                            {!isMobile && <MenubarShortcut>⇧⌦</MenubarShortcut>}
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
        {!message.isCollapsed && message.replies.map(reply => renderMessage(reply, threadId, depth + 1, message.id))}
      </div>
    )
  }  /*   const handleSendMessage = useCallback(async () => {
      if (currentThread && newMessageContent.trim()) {
        const newMessageId = Date.now().toString(); // Generate a new ID for the message
        addMessage(currentThread, replyingTo, newMessageContent, 'user', newMessageId);
        setNewMessageContent('');
        setSelectedMessage(newMessageId); // Set the current selected message as the sent message
        setReplyingTo(newMessageId); // Set replyingTo to the new message ID
        if (newMessageInputRef.current) {
          newMessageInputRef.current.focus();
        }
      }
    }, [currentThread, replyingTo, newMessageContent, addMessage]);
  
    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    }, [handleSendMessage])
   */
  const findMessageById = useCallback((messages: Message[], id: string): Message | null => {
    for (const message of messages) {
      if (message.id === id) return message
      const found = findMessageById(message.replies, id)
      if (found) return found
    }
    return null
  }, [])

  const handleModelChange = useCallback((field: keyof Model, value: string | number) => {
    if (editingModel) {
      setEditingModel({ ...editingModel, [field]: value })
    }
  }, [editingModel])

  const saveModelChanges = useCallback(() => {
    if (editingModel) {
      setModels((prev: Model[]) => prev.map((model: Model) =>
        model.id === editingModel.id ? { ...model, ...editingModel } : model
      ))
      setEditingModel(null)
    }
  }, [editingModel])

  const deleteModel = useCallback((id: string) => {
    setModels((prev: any[]) => prev.filter((model: { id: string }) => model.id !== id))
    if (selectedModel === id) {
      setSelectedModel(models[0].id)
    }
  }, [models, selectedModel])

  const addNewModel = useCallback(() => {
    const newModel: Model = {
      id: Date.now().toString(),
      name: 'New Model',
      baseModel: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      maxTokens: 1024
    }
    setModels((prev: any) => [...prev, newModel])
    setEditingModel(newModel)
  }, [])

  const toggleThreadPin = useCallback((threadId: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) =>
      thread.id === threadId ? { ...thread, isPinned: !thread.isPinned } : thread
    ))
  }, [])

  const deleteThread = useCallback((threadId: string) => {
    setThreads((prev: Thread[]) => prev.filter((thread) => thread.id !== threadId))
    if (currentThread === threadId) {
      setCurrentThread(null)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedMessage || !currentThread) return;

      const currentThreadData = threads.find(t => t.id === currentThread);
      if (!currentThreadData) return;

      const findMessageAndParent = (messages: Message[], targetId: string, parent: Message | null = null): [Message | null, Message | null] => {
        for (const message of messages) {
          if (message.id === targetId) return [message, parent];
          const [found, foundParent] = findMessageAndParent(message.replies, targetId, message);
          if (found) return [found, foundParent];
        }
        return [null, null];
      };

      const [currentMessage, parentMessage] = findMessageAndParent(currentThreadData.messages, selectedMessage);
      if (!currentMessage) return;

      const getSiblings = (parent: Message | null): Message[] => {
        if (!parent) return currentThreadData.messages;
        return parent.replies;
      };

      switch (event.key) {
        case 'ArrowLeft':
          // Select parent message
          if (parentMessage) {
            setSelectedMessage(parentMessage.id);
          }
          break;
        case 'ArrowRight':
          // Select first child message
          if (currentMessage.replies.length > 0) {
            setSelectedMessage(currentMessage.replies[0].id);
          }
          break;
        case 'ArrowUp':
          // Select previous sibling
          const siblings = getSiblings(parentMessage);
          const currentIndex = siblings.findIndex(m => m.id === currentMessage.id);
          if (currentIndex > 0) {
            setSelectedMessage(siblings[currentIndex - 1].id);
          }
          break;
        case 'ArrowDown':
          // Select next sibling
          const nextSiblings = getSiblings(parentMessage);
          const nextIndex = nextSiblings.findIndex(m => m.id === currentMessage.id);
          if (nextIndex < nextSiblings.length - 1) {
            setSelectedMessage(nextSiblings[nextIndex + 1].id);
          }
          break;
        case 'r':
          if (event.altKey) {
            // Alt+R for replying to a message
            event.preventDefault();
            if (currentThread) {
              addEmptyReply(currentThread, selectedMessage);
            }
          }
          break;
        case 'g':
          if (event.altKey) {
            // Alt+G for generating AI reply
            event.preventDefault();
            if (currentThread) {
              generateAIReply(currentThread, selectedMessage);
            }
          }
          break;
        case 'Insert':
          // Insert for editing a message
          const currentThreadData = threads.find(t => t.id === currentThread);
          if (currentThreadData) {
            const message = findMessageById(currentThreadData.messages, selectedMessage);
            if (message) {
              startEditingMessage(message);
            }
          }
          break;
        case 'Delete':
          // Delete for deleting a message
          if (currentThread) {
            if (event.shiftKey) {
              // Shift+Delete to delete the message and its children
              deleteMessage(currentThread, selectedMessage, true);
            } else {
              // Regular Delete to delete only the message
              deleteMessage(currentThread, selectedMessage, false);
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMessage, currentThread, threads, generateAIReply, addEmptyReply, startEditingMessage, deleteMessage]);

  const sortedThreads = threads.sort((a: { isPinned: any }, b: { isPinned: any }) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

  function renderThreadsList() {
    return (
      <>
        <div className="flex items-center justify-between space-x-2">
          <h2 className="text-xl font-bold pl-2">Threads</h2>
          <Button size="default" onClick={addThread}>
            <ListPlus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-10rem)] mt-2">
          <div className="flex-grow overflow-y-auto mb-4">
            {sortedThreads.map(thread => (
              <div
                key={thread.id}
                className={`p-2 cursor-pointer rounded-sm mb-2 ${currentThread === thread.id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              >
                <div className="flex items-center space-x-2">
                  <div className="flex-grow" onClick={() => setCurrentThread(thread.id)}>
                    {editingThreadTitle === thread.id ? (
                      <Input
                        ref={threadTitleInputRef}
                        value={thread.title}
                        onChange={(e) => editThreadTitle(thread.id, e.target.value)}
                        className="min-font-size"
                        onBlur={() => setEditingThreadTitle(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingThreadTitle(null)
                          }
                        }}
                      />
                    ) : (
                      <span className="pl-1" onDoubleClick={() => setEditingThreadTitle(thread.id)}>{thread.title}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleThreadPin(thread.id)}>
                    {thread.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteThread(thread.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </>
    )
  }

  function renderMessages() {
    const currentThreadData = threads.find(t => t.id === currentThread);
    return currentThread ? (
      <div className={`flex flex-col ${isMobile ? 'h-[calc(90vh)]' : 'h-full'}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold pl-2">
            {currentThreadData?.title}
          </h1>
          <Button size="default" onClick={() => addEmptyReply(currentThread, null)}>
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-grow">
          <div className="mb-4">
            {currentThreadData?.messages.map((message: any) => renderMessage(message, currentThread))}
          </div>
        </ScrollArea>
      </div>
    ) : (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select a thread to view messages</p>
      </div>
    )
  }

  function renderModelConfig() {
    return (
      <>
        <div className="flex items-center space-x-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="default" onClick={addNewModel}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-10rem)] mt-2">
          <div className="space-y-4">
            {models.map((model: { id: any; name: any; baseModel: any; temperature: any; maxTokens: any; systemPrompt: any }) => (
              <div key={model.id} className="p-2 border rounded">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold">{model.name}</h3>
                  <Button variant="outline" size="icon" onClick={() => setEditingModel(model)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                {editingModel?.id === model.id ? (
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input className="min-font-size" value={editingModel?.name} onChange={(e: { target: { value: any } }) => handleModelChange('name', e.target.value)} />
                    <Label>Base Model</Label>
                    <Input className="min-font-size" value={editingModel?.baseModel} onChange={(e: { target: { value: any } }) => handleModelChange('baseModel', e.target.value)} />
                    <Label>System Prompt</Label>
                    <Textarea className="min-font-size" value={editingModel?.systemPrompt} onChange={(e: { target: { value: any } }) => handleModelChange('systemPrompt', e.target.value)} />
                    <div className="flex items-center justify-between">
                      <Label>Temperature</Label>
                      <Input
                        type="number"
                        value={editingModel?.temperature}
                        onChange={(e) => handleModelChange('temperature', parseFloat(e.target.value))}
                        className="min-font-size w-18 h-6 text-right text-xs"
                        step="0.01"
                        min="0"
                        max="1"
                      />
                    </div>
                    {editingModel && <Slider defaultValue={[.7]} max={1} step={.01} value={[editingModel.temperature]} onValueChange={(value: number[]) => handleModelChange('temperature', value[0])} className="h-4" />}
                    <div className="flex items-center justify-between mt-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={editingModel?.maxTokens}
                        onChange={(e) => handleModelChange('maxTokens', parseInt(e.target.value))}
                        className="min-font-size w-18 h-6 text-right text-xs"
                        step="10"
                        min="1"
                        max="4096"
                      />
                    </div>
                    {editingModel && <Slider defaultValue={[1024]} max={4096} step={10} value={[editingModel.maxTokens]} onValueChange={(value: number[]) => handleModelChange('maxTokens', value[0])} className="h-4" />}
                    <div className="flex justify-between items-center mt-2">
                      <div className="space-x-2">
                        <Button size="icon" onClick={saveModelChanges}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setEditingModel(null)}>
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
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col md:flex-row p-2">
      {isMobile ? (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'threads' | 'messages' | 'models')} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="threads">Threads</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
          </TabsList>
          <TabsContent value="threads" className="flex-grow overflow-y-auto">
            {renderThreadsList()}
          </TabsContent>
          <TabsContent value="messages" className="flex-grow overflow-y-auto">
            {renderMessages()}
          </TabsContent>
          <TabsContent value="models" className="flex-grow overflow-y-auto">
            {renderModelConfig()}
          </TabsContent>
        </Tabs>
      ) : (
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full"
        >
          <ResizablePanel defaultSize={25} minSize={20} maxSize={50}>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'threads' | 'models')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="threads">Threads</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
              </TabsList>
              <TabsContent value="threads" className="flex-grow overflow-y-auto pt-1">
                {renderThreadsList()}
              </TabsContent>
              <TabsContent value="models" className="flex-grow overflow-y-auto pt-1">
                {renderModelConfig()}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-2" />
          <ResizablePanel defaultSize={75}>
            <div className="h-full overflow-y-auto">
              {renderMessages()}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}