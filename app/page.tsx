'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Edit, Trash, RefreshCw, MessageSquare, X, Plus, Check, Settings, Pin, PinOff, Menu, Send } from 'lucide-react'
import { useMediaQuery } from 'usehooks-ts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

const MESSAGE_INDENT = 20; // Constant value for indentation
const COLLAPSE_THRESHOLD = 3; // Threshold for when to collapse indentation

interface Message {
  id: string
  content: string
  publisher: 'user' | 'ai'
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
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
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
  })

  if (!response.ok) {
    throw new Error('Failed to generate AI response')
  }

  const data = await response.json()
  console.log(data);
  return data.response

}

export default function ThreadedDocument() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThread, setCurrentThread] = useState<string | null>(null)
  const [models, setModels] = useState<Model[]>([
    { id: '1', name: 'Default AI', baseModel: 'gpt-4o-mini', systemPrompt: 'You are a helpful assistant.', temperature: 0.7, maxTokens: 512 }
  ])
  const [selectedModel, setSelectedModel] = useState<string>(models[0].id)
  const [newMessageContent, setNewMessageContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [selectedThreads, setSelectedThreads] = useState<string[]>([])
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'threads' | 'messages' | 'models'>('messages')
  const isMobile = useMediaQuery("(max-width: 768px)")

  const replyBoxRef = useRef<HTMLDivElement>(null)
  const threadTitleInputRef = useRef<HTMLInputElement>(null)
  const newMessageInputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const connectToBackend = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/connect`, { method: 'GET' });
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
      const newMessage: Message = { id: newMessageId || Date.now().toString(), content, publisher, replies: [], isCollapsed: false };
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
  }, [])

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

  const deleteMessage = useCallback((threadId: string, messageId: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread
      const removeMessage = (messages: Message[]): Message[] => {
        return messages.filter(message => {
          if (message.id === messageId) return false
          message.replies = removeMessage(message.replies)
          return true
        })
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

  const generateAIReply = useCallback(async (threadId: string, messageId: string) => {
    const thread = threads.find((t: { id: string }) => t.id === threadId)
    if (!thread) return

    const message = findMessageById(thread.messages, messageId)
    if (!message) return

    setIsGenerating(true)
    try {
      const model = models.find((m: { id: any }) => m.id === selectedModel) || models[0]
      const aiResponse = await generateAIResponse(message.content, model, threads, threadId, messageId)
      addMessage(threadId, messageId, aiResponse, 'ai')
    } catch (error) {
      console.error('Failed to generate AI response:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [threads, models, selectedModel, addMessage])

  const renderMessage = useCallback((message: Message, threadId: string, depth = 0) => {
    const indent = depth < COLLAPSE_THRESHOLD ? depth * MESSAGE_INDENT : (COLLAPSE_THRESHOLD * MESSAGE_INDENT) + ((depth - COLLAPSE_THRESHOLD) * (MESSAGE_INDENT / 8));

    const getTotalReplies = (msg: Message): number => {
      return msg.replies.reduce((total, reply) => total + 1 + getTotalReplies(reply), 0);
    };

    const totalReplies = getTotalReplies(message);

    return (
      <div key={message.id} className="mt-2" style={{ marginLeft: `${indent}px` }}>
        <div
          className={`flex items-start space-x-2 p-2 rounded hover:bg-gray-100 ${selectedMessage === message.id ? 'bg-gray-200' : ''}`}
          onClick={() => setSelectedMessage(message.id)}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(threadId, message.id);
            }}
          >
            {message.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex-grow overflow-hidden">
            <div className="flex flex-col">
              <span className={`font-bold ${message.publisher === 'ai' ? 'text-blue-600' : 'text-green-600'}`}>
                {message.publisher === 'ai' ? 'AI' : 'User'}
                {/*{message.publisher === 'ai' ? models.find(m => m.id === selectedModel)?.name || 'AI' : 'User'}*/}
              </span>
              {editingMessage === message.id ? (
                <Textarea
                  value={editingContent}
                  onChange={(e: { target: { value: any } }) => setEditingContent(e.target.value)}
                  className="flex-grow mt-1"
                />
              ) : (
                <div className="whitespace-pre-wrap break-words overflow-hidden mt-1">
                  {message.isCollapsed
                    ? `${message.content.split('\n')[0].slice(0, 50)}${message.content.length > 50 ? '...' : ''}${totalReplies > 0 ? ` (${totalReplies} ${totalReplies === 1 ? 'reply' : 'replies'})` : ''}`
                    : message.content
                  }
                </div>
              )}
            </div>
            {!message.isCollapsed && selectedMessage === message.id && (
              <div className="mt-2 space-x-2 flex flex-wrap">
                {editingMessage === message.id ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => confirmEditingMessage(threadId, message.id)}>
                      <Check className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Confirm</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditingMessage}>
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Cancel</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setReplyingTo(message.id)}>
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Reply</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => generateAIReply(threadId, message.id)} disabled={isGenerating}>
                      <RefreshCw className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Generate</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEditingMessage(message)}>
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Edit</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMessage(threadId, message.id)}>
                      <Trash className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Delete</span>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {!message.isCollapsed && message.replies.map(reply => renderMessage(reply, threadId, depth + 1))}
      </div>
    )
  }, [toggleCollapse, deleteMessage, generateAIReply, editingMessage, editingContent, startEditingMessage, cancelEditingMessage, confirmEditingMessage, isGenerating, selectedMessage])


  const handleSendMessage = useCallback(async () => {
    if (currentThread && newMessageContent.trim()) {
      const newMessageId = Date.now().toString(); // Generate a new ID for the message
      addMessage(currentThread, replyingTo, newMessageContent, 'user', newMessageId);
      setNewMessageContent('');
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

  const deleteThreads = useCallback(() => {
    setThreads((prev: Thread[]) => prev.filter((thread) => !selectedThreads.includes(thread.id)))
    setSelectedThreads([])
    if (currentThread && selectedThreads.includes(currentThread)) {
      setCurrentThread(null)
    }
  }, [selectedThreads, currentThread])

  /*   const toggleThreadSelection = useCallback((threadId: string) => {
      setSelectedThreads((prev: string[]) =>
        prev.includes(threadId)
          ? prev.filter((id: string) => id !== threadId)
          : [...prev, threadId]
      )
    }, [])
   */
  const sortedThreads = threads.sort((a: { isPinned: any }, b: { isPinned: any }) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

  function renderThreadsList() {
    return (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Threads</h2>
          <Button size="sm" onClick={addThread}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-10rem)] mt-4">
          <div className="flex-grow overflow-y-auto mb-4">
            {sortedThreads.map(thread => (
              <div
                key={thread.id}
                className={`p-2 cursor-pointer ${currentThread === thread.id ? 'bg-gray-200' : ''}`}
              >
                <div className="flex items-center space-x-2">
                  <div className="flex-grow" onClick={() => setCurrentThread(thread.id)}>
                    {editingThreadTitle === thread.id ? (
                      <Input
                        ref={threadTitleInputRef}
                        value={thread.title}
                        onChange={(e) => editThreadTitle(thread.id, e.target.value)}
                        onBlur={() => setEditingThreadTitle(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingThreadTitle(null)
                          }
                        }}
                      />
                    ) : (
                      <span onDoubleClick={() => setEditingThreadTitle(thread.id)}>{thread.title}</span>
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
    return currentThread ? (
      <div className={`flex flex-col ${isMobile ? 'h-[calc(90vh)]' : 'h-full'}`}>
        <h1 className="text-2xl font-bold p-4">
          {threads.find(t => t.id === currentThread)?.title}
        </h1>
        <ScrollArea className="flex-grow">
          <div className="mb-4">
            {threads.find((t: { id: any }) => t.id === currentThread)?.messages.map((message: any) => renderMessage(message, currentThread))}
          </div>
        </ScrollArea>
        <div className="bg-white p-4 border-t w-full sticky bottom-0" ref={replyBoxRef}>
          {replyingTo && (
            <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
              <span className="truncate">
                {(() => {
                  const replyMessage = findMessageById(threads.find((t: { id: any }) => t.id === currentThread)?.messages || [], replyingTo);
                  if (!replyMessage) {
                    setReplyingTo(null);
                    return null;
                  }
                  return replyMessage.content.length <= 50
                    ? `Replying to: ${replyMessage.content}`
                    : `Replying to: ${replyMessage.content.slice(0, 50)}...`;
                })()}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Textarea
              ref={newMessageInputRef}
              value={newMessageContent}
              onChange={(e: { target: { value: any } }) => setNewMessageContent(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="flex-grow resize-y"
              style={{ maxHeight: '200px', overflowY: 'auto' }}
            />
            <Button onClick={handleSendMessage} disabled={!newMessageContent.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
          <Button size="sm" onClick={addNewModel}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-10rem)] mt-4">
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
                    <Input value={editingModel?.name} onChange={(e: { target: { value: any } }) => handleModelChange('name', e.target.value)} />
                    <Label>Base Model</Label>
                    <Input value={editingModel?.baseModel} onChange={(e: { target: { value: any } }) => handleModelChange('baseModel', e.target.value)} />
                    <Label>System Prompt</Label>
                    <Textarea value={editingModel?.systemPrompt} onChange={(e: { target: { value: any } }) => handleModelChange('systemPrompt', e.target.value)} />
                    <Label>Temperature</Label>
                    <Input type="number" value={editingModel?.temperature} onChange={(e: { target: { value: string } }) => handleModelChange('temperature', parseFloat(e.target.value))} />
                    <Label>Max Tokens</Label>
                    <Input type="number" value={editingModel?.maxTokens} onChange={(e: { target: { value: string } }) => handleModelChange('maxTokens', parseInt(e.target.value))} />
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
          <TabsContent value="threads" className="flex-grow overflow-y-auto pt-1">
            {renderThreadsList()}
          </TabsContent>
          <TabsContent value="messages" className="flex-grow overflow-y-auto pt-1">
            {renderMessages()}
          </TabsContent>
          <TabsContent value="models" className="flex-grow overflow-y-auto pt-1">
            {renderModelConfig()}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="h-full overflow-y-auto border-r p-2 resize-x" style={{ minWidth: '25%', maxWidth: '75%' }}>
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
          </div>
          <div className="flex-grow h-full overflow-y-auto">
            {renderMessages()}
          </div>
        </>
      )}
    </div>
  )
}
