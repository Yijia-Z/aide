'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Edit, Trash, RefreshCw, MessageSquare, X, Check, Settings, Pin, PinOff, Menu, Send } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"

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

async function generateAIResponse(prompt: string, model: Model) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.baseModel,
      messages: [
        { role: 'system', content: model.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: model.temperature,
      max_tokens: model.maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate AI response')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export default function ThreadedDocument() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThread, setCurrentThread] = useState<string | null>(null)
  const [models, setModels] = useState<Model[]>([
    { id: '1', name: 'Default AI', baseModel: 'gpt-3.5-turbo', systemPrompt: 'You are a helpful assistant.', temperature: 0.7, maxTokens: 150 }
  ])
  const [selectedModel, setSelectedModel] = useState<string>(models[0].id)
  const [newMessageContent, setNewMessageContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isModelPanelOpen, setIsModelPanelOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [selectedThreads, setSelectedThreads] = useState<string[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const replyBoxRef = useRef<HTMLDivElement>(null)
  const threadTitleInputRef = useRef<HTMLInputElement>(null)
  const newMessageInputRef = useRef<HTMLTextAreaElement>(null)

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
  }, [])

  const addMessage = useCallback((threadId: string, parentId: string | null, content: string, publisher: 'user' | 'ai') => {
    setThreads((prev: Thread[]) => prev.map((thread) => {
      if (thread.id !== threadId) return thread;
      const newMessage: Message = { id: Date.now().toString(), content, publisher, replies: [], isCollapsed: false };
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
      const aiResponse = await generateAIResponse(message.content, model)
      addMessage(threadId, messageId, aiResponse, 'ai')
    } catch (error) {
      console.error('Failed to generate AI response:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [threads, models, selectedModel, addMessage])

  const renderMessage = useCallback((message: Message, threadId: string, depth = 0) => {
    return (
      <div key={message.id} className="mt-2" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="flex items-start space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleCollapse(threadId, message.id)}
          >
            {message.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="flex-grow">
            <div className="flex items-center space-x-2">
              <span className={`font-bold ${message.publisher === 'ai' ? 'text-blue-600' : 'text-green-600'}`}>
                {message.publisher === 'ai' ? 'AI' : 'User'}:
              </span>
              {editingMessage === message.id ? (
                <Input
                  value={editingContent}
                  onChange={(e: { target: { value: any } }) => setEditingContent(e.target.value)}
                  className="flex-grow"
                />
              ) : (
                <span>{message.content}</span>
              )}
            </div>
            {!message.isCollapsed && (
              <div className="mt-2 space-x-2">
                {editingMessage === message.id ? (
                  <>
                    <Button size="sm" onClick={() => confirmEditingMessage(threadId, message.id)}>
                      <Check className="h-4 w-4 mr-2" />
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditingMessage}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => setReplyingTo(message.id)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                    <Button size="sm" onClick={() => generateAIReply(threadId, message.id)} disabled={isGenerating}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEditingMessage(message)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMessage(threadId, message.id)}>
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
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
  }, [toggleCollapse, deleteMessage, generateAIReply, editingMessage, editingContent, startEditingMessage, cancelEditingMessage, confirmEditingMessage, isGenerating])

  const handleSendMessage = useCallback(async () => {
    if (currentThread && newMessageContent.trim()) {
      addMessage(currentThread, replyingTo, newMessageContent, 'user')
      setNewMessageContent('')
      setReplyingTo(null)
      if (newMessageInputRef.current) {
        newMessageInputRef.current.focus()
      }
    }
  }, [currentThread, replyingTo, newMessageContent, addMessage])

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
      baseModel: 'gpt-3.5-turbo',
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      maxTokens: 150
    }
    setModels((prev: any) => [...prev, newModel])
    setEditingModel(newModel)
  }, [])

  const toggleThreadPin = useCallback((threadId: string) => {
    setThreads((prev: Thread[]) => prev.map((thread) =>
      thread.id === threadId ? { ...thread, isPinned: !thread.isPinned } : thread
    ))
  }, [])

  const deleteThreads = useCallback(() => {
    setThreads((prev: Thread[]) => prev.filter((thread) => !selectedThreads.includes(thread.id)))
    setSelectedThreads([])
    if (currentThread && selectedThreads.includes(currentThread)) {
      setCurrentThread(null)
    }
  }, [selectedThreads, currentThread])

  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreads((prev: string[]) =>
      prev.includes(threadId)
        ? prev.filter((id: string) => id !== threadId)
        : [...prev, threadId]
    )
  }, [])

  const sortedThreads = threads.sort((a: { isPinned: any }, b: { isPinned: any }) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })

  const ThreadList = () => (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Threads</h2>
        {selectedThreads.length > 0 && (
          <Button variant="destructive" size="sm" onClick={deleteThreads}>
            Delete Selected
          </Button>
        )}
      </div>
      <ScrollArea className="flex-grow mb-4">
        {sortedThreads.map((thread: { id: any; title: any; isPinned: any }) => (
          <div
            key={thread.id}
            className={`p-2 cursor-pointer ${currentThread === thread.id ? 'bg-gray-200' : ''} ${selectedThreads.includes(thread.id) ? 'bg-blue-100' : ''}`}
          >
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedThreads.includes(thread.id)}
                onCheckedChange={() => toggleThreadSelection(thread.id)}
              />
              <div className="flex-grow" onClick={() => setCurrentThread(thread.id)}>
                {editingThreadTitle === thread.id ? (
                  <Input
                    ref={threadTitleInputRef}
                    value={thread.title}
                    onChange={(e: { target: { value: any } }) => editThreadTitle(thread.id, e.target.value)}
                    onBlur={() => setEditingThreadTitle(null)}
                    onKeyPress={(e: { key: string }) => {
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
            </div>
          </div>
        ))}
      </ScrollArea>
      <Button className="mb-4" onClick={addThread}>New Thread</Button>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Models</h2>
        <Sheet open={isModelPanelOpen} onOpenChange={setIsModelPanelOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Model Configuration</SheetTitle>
              <SheetDescription>Configure AI models for your responses.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-10rem)] mt-4">
              <div className="space-y-4">
                {models.map((model: { id: any; name: any; baseModel: any; temperature: any; maxTokens: any; systemPrompt: any }) => (
                  <div key={model.id} className="p-2 border rounded">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold">{model.name}</h3>
                      <Button variant="outline" size="sm" onClick={() => setEditingModel(model)}>Edit</Button>
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
                        <div className="flex justify-end space-x-2 mt-2">
                          <Button onClick={saveModelChanges}>Save</Button>
                          <Button variant="outline" onClick={() => setEditingModel(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p>Base Model: {model.baseModel}</p>
                        <p>Temperature: {model.temperature}</p>
                        <p>Max Tokens: {model.maxTokens}</p>
                      </div>
                    )}
                    <Button variant="destructive" size="sm" className="mt-2" onClick={() => deleteModel(model.id)}>Delete</Button>
                  </div>
                ))}
                <Button onClick={addNewModel}>Add New Model</Button>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger>
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model: { id: any; name: any }) => (
            <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex h-screen">
      <div className="md:w-1/4 md:p-4 md:border-r hidden md:block">
        <ThreadList />
      </div>
      <div className="flex-grow p-4 flex flex-col">
        <div className="md:hidden mb-4">
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="p-4 h-[80vh]">
                <ThreadList />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
        {currentThread && (
          <>
            <h1 className="text-2xl font-bold mb-4">
              {threads.find((t: { id: any }) => t.id === currentThread)?.title}
            </h1>
            <ScrollArea className="flex-grow mb-4">
              {threads.find((t: { id: any }) => t.id === currentThread)?.messages.map((message: any) => renderMessage(message, currentThread))}
            </ScrollArea>
            <div className="mt-4 sticky bottom-0 bg-white p-4 border-t" ref={replyBoxRef}>
              {replyingTo && (
                <div className="mb-2 p-2 bg-gray-100 rounded flex justify-between items-center">
                  <span>
                    Replying to: {findMessageById(threads.find((t: { id: any }) => t.id === currentThread)?.messages || [], replyingTo)?.content.slice(0, 50)}...
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
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-grow"
                />
                <Button onClick={handleSendMessage} disabled={!newMessageContent.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}