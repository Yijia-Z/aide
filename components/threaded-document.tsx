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
import ModelEditor from "@/components/model/model-editor";
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

  return (
    <div className="flex flex-col h-screen">
      <AideTabs activeTab={activeTab} setActiveTab={setActiveTab} />
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
                setCurrentThread(prev[0]?.id || null);
              }
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
                onEditMessage={startEditingMessage}
                onDeleteMessage={(messageId) => deleteMessage(currentThread!, messageId, false)}
                onToggleMessageCollapse={(messageId) => toggleCollapse(currentThread!, messageId)}
                onCopyMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "copy")}
                onCutMessage={(messageId) => copyOrCutMessage(currentThread!, messageId, "cut")}
            />
          )}
        {editingMessage && (
            <MessageEditor
                initialContent={editingContent}
                onSave={(content) => editingMessage(currentThread!, editingMessage, content)}
                onCancel={cancelEditingMessage}
            />
        )}
        </TabsContent>
        <TabsContent value="models" className="h-full">
          <ModelEditor
            model={editingModel || DEFAULT_MODEL}
            onModelChange={handleModelChange}
            onSave={() => {
              if (editingModel) {
                setModels((prev) =>
                  prev.map((m) => (m.id === editingModel.id ? editingModel : m))
                );
                setEditingModel(null);
              }
            }}
            onCancel={() => setEditingModel(null)}
          />
        </TabsContent>
      </div>
    </div>
  );
}