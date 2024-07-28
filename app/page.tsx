
"use client";
import React, { useState } from 'react';
import { Bird, Book, Bot, Code2, CornerDownLeft, LifeBuoy, Rabbit, Settings, Settings2, Share, SquareTerminal, SquareUser, Triangle, Turtle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Message = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  replies?: Message[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentRole, setCurrentRole] = useState<'user' | 'assistant'>('user');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.4);
  const [topP, setTopP] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(100);

  const addMessage = () => {
    if (replyingTo) {
      const parent = findMessageById(messages, replyingTo.id);
      if (parent) {
        addReply(parent.id, currentRole, currentMessage);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: currentRole, content: currentMessage, replies: [] },
      ]);
    }
    setCurrentMessage('');
    setReplyingTo(null);
  };

  const runOpenAIAPI = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: collectParentMessages(replyingTo ? replyingTo.id : null),
          configuration: { model, temperature, top_p: topP, max_tokens: maxTokens },
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      if (replyingTo) {
        addReply(replyingTo.id, 'assistant', data.choices[0].message.content);
      }
    } catch (error) {
      console.error('Failed to fetch OpenAI API:', error);
    }
  };

  const addReply = (id: number, role: 'user' | 'assistant', content: string) => {
    const replyMessage = (messages: Message[]): Message[] => {
      return messages.map((msg) => {
        if (msg.id === id) {
          return {
            ...msg,
            replies: [...(msg.replies ?? []), { id: Date.now(), role, content, replies: [] }],
          };
        } else if (msg.replies && msg.replies.length > 0) {
          return { ...msg, replies: replyMessage(msg.replies) };
        } else {
          return msg;
        }
      });
    };

    setMessages((prev) => replyMessage(prev));
  };

  const findMessageById = (messages: Message[], id: number): Message | null => {
    for (let msg of messages) {
      if (msg.id === id) {
        return msg;
      }
      if (msg.replies) {
        const found = findMessageById(msg.replies, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const collectParentMessages = (id: number | null): Message[] => {
    if (id === null) return [];
    const messagesStack: Message[] = [];
    const findMessageStack = (messages: Message[], id: number): boolean => {
      for (let msg of messages) {
        if (msg.id === id) {
          messagesStack.push(msg);
          return true;
        }
        if (msg.replies && findMessageStack(msg.replies, id)) {
          messagesStack.push(msg);
          return true;
        }
      }
      return false;
    };
    findMessageStack(messages, id);
    return messagesStack.reverse();
  };

  return (
    <div className="grid h-screen w-full pl-[56px]">
      <aside className="inset-y fixed left-0 z-20 flex h-full flex-col border-r">
        <div className="border-b p-2">
          <Button variant="outline" size="icon" aria-label="Home">
            <Triangle className="size-5 fill-foreground" />
          </Button>
        </div>
        <TooltipProvider>
          <nav className="grid gap-1 p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg bg-muted" aria-label="Playground">
                  <SquareTerminal className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Playground
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Models">
                  <Bot className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Models
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg" aria-label="API">
                  <Code2 className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                API
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Documentation">
                  <Book className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Documentation
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Settings">
                  <Settings2 className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Settings
              </TooltipContent>
            </Tooltip>
          </nav>
          <nav className="mt-auto grid gap-1 p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="mt-auto rounded-lg" aria-label="Help">
                  <LifeBuoy className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Help
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="mt-auto rounded-lg" aria-label="Account">
                  <SquareUser className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={5}>
                Account
              </TooltipContent>
            </Tooltip>
          </nav>
        </TooltipProvider>
      </aside>
      <div className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4">
          <h1 className="text-xl font-semibold">Playground</h1>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Settings className="size-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>Configuration</DrawerTitle>
                <DrawerDescription>
                  Configure the settings for the model and messages.
                </DrawerDescription>
              </DrawerHeader>
              <form className="grid w-full items-start gap-6 overflow-auto p-4 pt-0">
                <fieldset className="grid gap-6 rounded-lg border p-4">
                  <legend className="-ml-1 px-1 text-sm font-medium">Settings</legend>
                  <div className="grid gap-3">
                    <Label htmlFor="model-drawer">Model</Label>
                    <Select value={model} onValueChange={(value) => setModel(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      placeholder="0.4"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="top-p">Top P</Label>
                    <Input id="top-p" type="number" placeholder="0.7" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input id="max-tokens" type="number" placeholder="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} />
                  </div>
                </fieldset>
              </form>
            </DrawerContent>
          </Drawer>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
            <Share className="size-3.5" />
            Share
          </Button>
        </header>
        <main className="grid flex-1 gap-4 overflow-auto p-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative hidden flex-col items-start gap-8 md:flex" x-chunk="dashboard-03-chunk-0">
            <form className="grid w-full items-start gap-6">
              <fieldset className="grid gap-6 rounded-lg border p-4">
                <legend className="-ml-1 px-1 text-sm font-medium">Settings</legend>
                <div className="grid gap-3">
                  <Label htmlFor="model">Model</Label>
                  <Select value="model" onValueChange={(value) => setModel(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    placeholder="0.4"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="top-p">Top P</Label>
                  <Input id="top-p" type="number" placeholder="0.7" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input id="max-tokens" type="number" placeholder="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} />
                </div>
              </fieldset>
            </form>
          </div>
          <div className="relative flex h-full min-h-[50vh] flex-col rounded-xl bg-muted/50 p-4 lg:col-span-2">
            <Badge variant="outline" className="absolute right-3 top-3">Output</Badge>
            <div className="flex-1 overflow-auto">
              {messages.map((message) => (
                <MessageThread
                  key={message.id}
                  message={message}
                  addReply={addReply}
                  setReplyingTo={setReplyingTo}
                />
              ))}
            </div>
            <form className="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring" x-chunk="dashboard-03-chunk-1">
              <Label htmlFor="message" className="sr-only">Message</Label>
              {replyingTo && (
                <p className="ml-3 mt-2 text-xs">
                  Replying to - &quot;{replyingTo.content.length > 20 ? replyingTo.content.slice(0, 20) + '...' : replyingTo.content}&quot;
                </p>
              )}
              <Textarea
                id="message"
                placeholder="Type your message here..."
                className="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
              />
              <div className="flex items-center p-3 pt-0">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentRole(currentRole === 'user' ? 'assistant' : 'user')}>
                  {currentRole === 'user' ? 'User' : 'Assistant'}
                </Button>
                <Button type="button" size="sm" className="ml-auto gap-1.5" onClick={addMessage}>
                  Add
                  <CornerDownLeft className="size-3.5" />
                </Button>
                <Button type="button" size="sm" className="ml-2 gap-1.5" onClick={runOpenAIAPI}>
                  Run
                  <CornerDownLeft className="size-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

type MessageThreadProps = {
  message: Message;
  addReply: (id: number, role: 'user' | 'assistant', content: string) => void;
  setReplyingTo: (message: Message) => void;
};

const MessageThread: React.FC<MessageThreadProps> = ({ message, addReply, setReplyingTo }) => {
  return (
    <div className="border rounded-lg p-3 mb-2">
      <div className={`${message.role === 'user' ? 'text-blue-600' : 'text-gray-600'} `}>
        <strong>{message.role}</strong>: {message.content}
      </div>
      <div className="flex justify-end mt-2">
        <Button variant="outline" size="icon" onClick={() => { setReplyingTo(message); }}>
          Reply
        </Button>
      </div>
      <div className="pl-4 mt-2">
        {message.replies && message.replies.map((reply) => (
          <MessageThread key={reply.id} message={reply} addReply={addReply} setReplyingTo={setReplyingTo} />
        ))}
      </div>
    </div>
  );
};