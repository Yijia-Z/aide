import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Message, Thread, Model, Tool } from '@/components/types';
import { generateAIResponse } from '@/components/utils/api';
import { v4 as uuidv4 } from 'uuid';

interface AddMessageParams {
    id?: string;
    threadId: string;
    parentId: string | null;
    publisher: "user" | "ai";
    content: string | any[];
    modelConfig?: any;
    userName?: string;
    generateAIResponse?: {
        model: Model;
        userKey?: string;
        abortController?: AbortController;
        onChunk: (chunk: string) => void;
        globalPrompt?: string | null;
    };
}

interface UpdateMessageParams {
    messageId: string;
    threadId: string;
    publisher: "user" | "ai";
    content: string | any[];
}

interface DeleteMessageParams {
    messageId: string;
    threadId: string;
    deleteOption: boolean | 'clear';
}

interface CopyMessageParams {
    messageId: string;
    threadId: string;
    operation: "copy" | "cut";
}

interface PasteMessageParams {
    threadId: string;
    parentId: string | null;
    clipboardMessage: {
        message: Message;
        operation: "copy" | "cut";
        sourceThreadId: string | null;
        originalMessageId: string | null;
    };
}

// Helper function to remove a message from a message tree
const removeMessageFromTree = (messages: Message[], targetId: string): Message[] => {
    return messages.filter(m => {
        if (m.id === targetId) return false;
        m.replies = removeMessageFromTree(m.replies, targetId);
        return true;
    });
};

export function useMessagesMutation() {
    const queryClient = useQueryClient();

    const addMessage = useMutation({
        mutationFn: async (params: AddMessageParams) => {
            const messageId = params.id || uuidv4();
            const defaultContent = [{ type: "text", text: "" }];
            const newMessage: Message = {
                id: messageId,
                content: params.content || defaultContent,
                publisher: params.publisher,
                modelConfig: params.modelConfig,
                replies: [],
                isCollapsed: false,
                userCollapsed: false,
                userName: undefined
            };

            // Create message in database first to get the username
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: messageId,
                    threadId: params.threadId,
                    parentId: params.parentId,
                    publisher: params.publisher,
                    content: params.content || defaultContent,
                    modelConfig: params.modelConfig
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create message");
            }

            const data = await response.json();
            // Update newMessage with the server response
            newMessage.userName = data.message.userName;

            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['messages', params.threadId] });
            await queryClient.cancelQueries({ queryKey: ['threads'] });

            // Get current messages from cache or initialize if not exists
            const currentMessages = queryClient.getQueryData<Message[]>(['messages', params.threadId]) || [];

            // Update messages cache
            const updatedMessages = !params.parentId
                ? [...currentMessages, newMessage]
                : currentMessages.map(msg => addMessageToParent(msg, params.parentId!, newMessage));

            // Update both caches
            queryClient.setQueryData<Message[]>(['messages', params.threadId], updatedMessages);

            // Update threads cache
            queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
                return old.map(thread => {
                    if (thread.id !== params.threadId) return thread;
                    return {
                        ...thread,
                        messages: updatedMessages,
                        updatedAt: new Date().toISOString()
                    };
                });
            });

            // Invalidate queries to ensure fresh data
            queryClient.invalidateQueries({ queryKey: ['messages', params.threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });

            // If this is an AI message that needs response generation
            if (params.generateAIResponse) {
                const { model, userKey, abortController, onChunk } = params.generateAIResponse;
                let fullResponse = "";

                // Get current threads from cache and find the specific thread
                const threads = queryClient.getQueryData<Thread[]>(['threads']) || [];
                const currentThread = threads.find(t => t.id === params.threadId);

                if (!currentThread) {
                    throw new Error("Thread not found");
                }

                // Get messages for this thread from cache
                const messages = queryClient.getQueryData<Message[]>(['messages', params.threadId]);

                // Use the thread with its messages for context
                const threadWithMessages = {
                    ...currentThread,
                    messages: messages || currentThread.messages || []
                };

                // Helper function to find a message in a nested structure
                const findMessageById = (messages: Message[], id: string): Message | null => {
                    for (const message of messages) {
                        if (message.id === id) return message;
                        const found = findMessageById(message.replies, id);
                        if (found) return found;
                    }
                    return null;
                };

                // First try to find the parent message in the nested structure
                const parentMessage = findMessageById(threadWithMessages.messages, params.parentId!);
                if (!parentMessage) {
                    throw new Error("Parent message not found");
                }

                let finalContent: string;
                if (typeof parentMessage.content === "string") {
                    finalContent = parentMessage.content;
                } else if (Array.isArray(parentMessage.content)) {
                    finalContent = parentMessage.content
                        .filter(part => part.type === "text")
                        .map(part => part.text)
                        .join("\n");
                } else {
                    finalContent = "";
                }

                const enabledTools = (model.parameters?.tool_choice !== "none" &&
                    model.parameters?.tool_choice !== undefined
                    ? model.parameters?.tools ?? []
                    : []) as Tool[];

                await generateAIResponse(
                    finalContent,
                    parentMessage.publisher,
                    model,
                    [threadWithMessages],
                    params.threadId,
                    params.parentId,
                    enabledTools,
                    (chunk) => {
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data:")) {
                                const dataStr = line.replace("data:", "").trim();
                                if (dataStr === "[DONE]") return;
                                try {
                                    const data = JSON.parse(dataStr);
                                    const delta = data.choices[0].delta || {};
                                    if (delta.content) {
                                        fullResponse += delta.content;
                                        onChunk(fullResponse);

                                        // Update both caches with the new content
                                        const newContent = [{
                                            type: "text",
                                            text: fullResponse
                                        }];

                                        // Update message content in both caches
                                        updateMessageInCaches(messageId, params.threadId, newContent);
                                    }
                                } catch (error) {
                                    console.error("Error parsing chunk:", error);
                                }
                            }
                        }
                    },
                    userKey,
                    abortController,
                    params.generateAIResponse.globalPrompt
                );

                // Update final response in database
                if (fullResponse.trim()) {
                    await updateMessage.mutateAsync({
                        messageId,
                        content: [{
                            type: "text",
                            text: fullResponse.trim()
                        }],
                        publisher: "ai",
                        threadId: params.threadId
                    });
                }
            }

            return data;
        }
    });

    // Helper function to add message to parent
    const addMessageToParent = (message: Message, parentId: string, newMessage: Message): Message => {
        if (message.id === parentId) {
            return {
                ...message,
                replies: [...message.replies, newMessage]
            };
        }
        return {
            ...message,
            replies: message.replies.map(reply => addMessageToParent(reply, parentId, newMessage))
        };
    };

    const updateMessage = useMutation({
        mutationFn: async ({ messageId, content, publisher, threadId }: UpdateMessageParams) => {
            const response = await fetch(`/api/messages/${messageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                throw new Error("Failed to update message");
            }

            return response.json();
        },
        onMutate: async ({ messageId, content, publisher, threadId }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['messages'] });
            await queryClient.cancelQueries({ queryKey: ['threads'] });

            // Update both caches with the new content
            updateMessageInCaches(messageId, threadId, content);

            return { content };
        },
        onError: (err, variables, context) => {
            if (context) {
                // Revert the changes on error
                updateMessageInCaches(variables.messageId, variables.threadId, context.content);
            }
        },
        onSettled: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    const deleteMessage = useMutation({
        mutationFn: async ({ messageId, threadId, deleteOption }: DeleteMessageParams) => {
            const response = await fetch(`/api/messages/${messageId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deleteOption }),
            });

            if (!response.ok) {
                throw new Error("Failed to delete message");
            }

            return response.json();
        },
        onMutate: async ({ messageId, threadId, deleteOption }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['messages', threadId] });
            await queryClient.cancelQueries({ queryKey: ['threads'] });

            // Snapshot the previous value
            const previousMessages = queryClient.getQueryData<Message[]>(['messages', threadId]);
            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);
            const previousSelectedMessages = queryClient.getQueryData(['selectedMessages']) as Record<string, string | null>;

            // Helper function to find message and its parents
            const findMessageAndParents = (messages: Message[], targetId: string, parents: Message[] = []): [Message | null, Message[]] => {
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

            // Helper function to remove message from tree
            const removeMessageFromTree = (messages: Message[]): Message[] => {
                const [messageToDelete, parentMessages] = findMessageAndParents(messages, messageId);
                if (!messageToDelete) return messages;

                const filterAndMerge = (msgs: Message[]) => {
                    if (deleteOption === true) {
                        // Delete with all replies
                        return msgs.filter((m) => m.id !== messageId);
                    } else if (deleteOption === 'clear') {
                        // Clear children but keep message
                        return msgs.map(m =>
                            m.id === messageId
                                ? { ...m, replies: [] }
                                : m
                        );
                    } else {
                        // Keep replies
                        return [
                            ...msgs.filter((m) => m.id !== messageId),
                            ...messageToDelete.replies,
                        ];
                    }
                };

                // Update message selection
                if (deleteOption !== 'clear') {
                    const newSelectedMessages = { ...previousSelectedMessages };
                    if (parentMessages.length > 0) {
                        // If message has a parent, select the parent
                        newSelectedMessages[threadId] = parentMessages[parentMessages.length - 1].id;
                    } else {
                        // If message is at root level, clear selection
                        newSelectedMessages[threadId] = null;
                    }
                    queryClient.setQueryData(['selectedMessages'], newSelectedMessages);
                }

                if (parentMessages.length === 0) {
                    return filterAndMerge(messages);
                }

                const updateParent = (message: Message): Message => {
                    if (message.id === parentMessages[parentMessages.length - 1].id) {
                        return { ...message, replies: filterAndMerge(message.replies) };
                    }
                    return { ...message, replies: message.replies.map(updateParent) };
                };

                return messages.map(updateParent);
            };

            // Optimistically update messages cache
            if (previousMessages) {
                queryClient.setQueryData<Message[]>(['messages', threadId], old => {
                    if (!old) return [];
                    return removeMessageFromTree(old);
                });
            }

            // Optimistically update threads cache
            if (previousThreads) {
                queryClient.setQueryData<Thread[]>(['threads'], old => {
                    if (!old) return [];
                    return old.map(thread => {
                        if (thread.id !== threadId) return thread;
                        return {
                            ...thread,
                            messages: removeMessageFromTree(thread.messages || [])
                        };
                    });
                });
            }

            // Return a context object with the snapshotted value
            return { previousMessages, previousThreads, previousSelectedMessages };
        },
        onError: (err, variables, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousMessages) {
                queryClient.setQueryData(['messages', variables.threadId], context.previousMessages);
            }
            if (context?.previousThreads) {
                queryClient.setQueryData(['threads'], context.previousThreads);
            }
            if (context?.previousSelectedMessages) {
                queryClient.setQueryData(['selectedMessages'], context.previousSelectedMessages);
            }
        },
        onSettled: (data, error, variables) => {
            // Always refetch after error or success to make sure our optimistic update matches the server state
            queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            queryClient.invalidateQueries({ queryKey: ['selectedMessages'] });
        },
    });

    const copyMessage = useMutation({
        mutationFn: async ({ messageId, threadId, operation }: CopyMessageParams) => {
            // No backend call needed for copy/cut, just return the message from cache
            const messages = queryClient.getQueryData<Message[]>(['messages', threadId]) || [];

            const findMessage = (msgs: Message[], id: string): Message | null => {
                for (const msg of msgs) {
                    if (msg.id === id) return {
                        ...msg,
                        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content as string }]
                    };
                    const found = findMessage(msg.replies, id);
                    if (found) return found;
                }
                return null;
            };

            const message = findMessage(messages, messageId);
            if (!message) throw new Error("Message not found");

            return { message, operation, threadId };
        }
    });

    const pasteMessage = useMutation({
        mutationFn: async ({ threadId, parentId, clipboardMessage }: PasteMessageParams) => {
            // Helper function to recursively create new IDs for the message tree
            const createMessageTreeWithNewIds = (message: Message): { newMessage: Message; idMap: Record<string, string> } => {
                const idMap: Record<string, string> = {};

                const processMessage = (msg: Message): Message => {
                    const newId = uuidv4();
                    idMap[msg.id] = newId;

                    return {
                        ...msg,
                        id: newId,
                        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content as string }],
                        replies: msg.replies.map(reply => processMessage(reply))
                    };
                };

                const newMessage = processMessage(message);
                return { newMessage, idMap };
            };

            const { newMessage, idMap } = createMessageTreeWithNewIds(clipboardMessage.message);

            // Create the message and its entire reply tree in the database
            const response = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messageTree: newMessage,
                    threadId,
                    parentId,
                    idMap
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to paste message");
            }

            const data = await response.json();
            return {
                newMessage: {
                    ...newMessage,
                    userName: data.message.userName
                },
                originalMessage: clipboardMessage.message,
                operation: clipboardMessage.operation,
                sourceThreadId: clipboardMessage.sourceThreadId,
                parentId
            };
        },
        onMutate: async ({ threadId, parentId, clipboardMessage }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['messages'] });
            await queryClient.cancelQueries({ queryKey: ['threads'] });

            // Create new IDs for the entire message tree
            const createMessageTreeWithNewIds = (message: Message): Message => {
                const processMessage = (msg: Message): Message => {
                    return {
                        ...msg,
                        id: uuidv4(),
                        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content as string }],
                        replies: msg.replies.map(reply => processMessage(reply))
                    };
                };

                return processMessage(message);
            };

            const newMessage = createMessageTreeWithNewIds(clipboardMessage.message);

            // Helper function to add message to parent
            const addMessageToParent = (messages: Message[]): Message[] => {
                return messages.map(msg => {
                    if (msg.id === parentId) {
                        return {
                            ...msg,
                            replies: [...msg.replies, newMessage]
                        };
                    }
                    return {
                        ...msg,
                        replies: addMessageToParent(msg.replies)
                    };
                });
            };

            // Update messages cache
            queryClient.setQueryData<Message[]>(['messages', threadId], (old = []) => {
                if (!parentId) {
                    return [...old, newMessage];
                }
                return addMessageToParent(old);
            });

            // Update threads cache
            queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
                return old.map(thread => {
                    if (thread.id !== threadId) return thread;

                    if (!parentId) {
                        return {
                            ...thread,
                            messages: [...(thread.messages || []), newMessage]
                        };
                    }

                    return {
                        ...thread,
                        messages: addMessageToParent(thread.messages || [])
                    };
                });
            });

            // If this was a cut operation, remove the original message from its source
            if (clipboardMessage.operation === "cut" && clipboardMessage.sourceThreadId) {
                // Remove from source thread using similar logic to deleteMessage
                const removeFromSource = (messages: Message[]): Message[] => {
                    return messages.filter(m => {
                        if (m.id === clipboardMessage.message.id) return false;
                        m.replies = removeFromSource(m.replies);
                        return true;
                    });
                };

                // Update source thread's messages
                queryClient.setQueryData<Message[]>(
                    ['messages', clipboardMessage.sourceThreadId],
                    (old = []) => removeFromSource(old)
                );

                // Update threads cache for source thread
                queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
                    return old.map(thread => {
                        if (thread.id !== clipboardMessage.sourceThreadId) return thread;
                        return {
                            ...thread,
                            messages: removeFromSource(thread.messages || [])
                        };
                    });
                });
            }

            return { newMessage, clipboardMessage };
        },
        onError: (err, variables, context) => {
            if (!context) return;

            // Revert the paste
            queryClient.setQueryData<Message[]>(['messages', variables.threadId], (old = []) => {
                return removeMessageFromTree(old, context.newMessage.id);
            });

            // Revert threads cache
            queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
                return old.map(thread => {
                    if (thread.id !== variables.threadId) return thread;
                    return {
                        ...thread,
                        messages: removeMessageFromTree(thread.messages || [], context.newMessage.id)
                    };
                });
            });

            // If it was a cut operation, restore the original message
            if (variables.clipboardMessage.operation === "cut" && variables.clipboardMessage.sourceThreadId) {
                // Restore to source thread's messages
                queryClient.setQueryData<Message[]>(
                    ['messages', variables.clipboardMessage.sourceThreadId],
                    (old = []) => [...old, variables.clipboardMessage.message]
                );

                // Restore to threads cache
                queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
                    return old.map(thread => {
                        if (thread.id !== variables.clipboardMessage.sourceThreadId) return thread;
                        return {
                            ...thread,
                            messages: [...(thread.messages || []), variables.clipboardMessage.message]
                        };
                    });
                });
            }
        },
        onSettled: (data, error, variables) => {
            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            if (variables.clipboardMessage.operation === "cut" && variables.clipboardMessage.sourceThreadId) {
                queryClient.invalidateQueries({
                    queryKey: ['messages', variables.clipboardMessage.sourceThreadId]
                });
            }
        }
    });

    // Helper function to update message content in both caches
    const updateMessageInCaches = (messageId: string, threadId: string, content: any) => {
        // 1. Update messages cache
        queryClient.setQueryData<Message[]>(['messages', threadId], (old = []) => {
            const updateMessageContent = (messages: Message[]): Message[] => {
                return messages.map(msg => {
                    if (msg.id === messageId) {
                        return { ...msg, content };
                    }
                    return {
                        ...msg,
                        replies: updateMessageContent(msg.replies)
                    };
                });
            };
            return updateMessageContent(old);
        });

        // 2. Update threads cache
        queryClient.setQueryData<Thread[]>(['threads'], (old = []) => {
            return old.map(thread => {
                if (thread.id !== threadId) return thread;

                const updateMessageContent = (messages: Message[]): Message[] => {
                    return messages.map(msg => {
                        if (msg.id === messageId) {
                            return { ...msg, content };
                        }
                        return {
                            ...msg,
                            replies: updateMessageContent(msg.replies)
                        };
                    });
                };

                return {
                    ...thread,
                    messages: updateMessageContent(thread.messages || [])
                };
            });
        });
    };

    return {
        addMessage,
        updateMessage,
        deleteMessage,
        copyMessage,
        pasteMessage
    };
} 