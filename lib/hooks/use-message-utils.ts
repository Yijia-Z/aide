import { useCallback } from 'react';
import { Message, ContentPart } from '@/components/types';
import { useToast } from './use-toast';
import { useMessagesMutation } from './use-messages-mutation';

interface UseMessageUtilsProps {
    editingContent: string;
    editingMessage: string | null;
    setEditingContent: (value: string) => void;
    setEditingMessage: (value: string | null) => void;
    setThreads: (value: any) => void;
}

export function useMessageUtils({
    editingContent,
    editingMessage,
    setEditingContent,
    setEditingMessage,
    setThreads
}: UseMessageUtilsProps) {
    const { toast } = useToast();
    const { updateMessage, deleteMessage } = useMessagesMutation();

    // Extract text from content
    const extractTextFromContent = useCallback((content: string | ContentPart[]) => {
        if (typeof content === "string") {
            return content;
        }

        // Get the first text part
        const textPart = content.find(p => p.type === "text");
        return textPart?.text || "";
    }, []);

    // Start editing a message
    const startEditingMessage = useCallback(
        (message: Message) => {
            setEditingMessage(message.id);

            if (Array.isArray(message.content)) {
                // Only concatenate text parts
                const textParts = message.content
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("\n\n");

                setEditingContent(textParts || "");
            } else if (typeof message.content === "string") {
                // Handle string content
                setEditingContent(message.content);
            } else {
                // Handle empty content
                setEditingContent("");
            }
        },
        [setEditingContent, setEditingMessage]
    );

    // Confirm editing a message
    const confirmEditingMessage = useCallback(
        async (threadId: string, messageId: string) => {
            console.log("[confirmEditingMessage] start, messageId =", messageId);

            let finalContent: ContentPart[];

            try {
                // Parse the content
                const maybeJson = JSON.parse(editingContent);
                if (Array.isArray(maybeJson)) {
                    finalContent = maybeJson;
                } else {
                    finalContent = [
                        {
                            type: "text",
                            text: editingContent.trim(),
                        },
                    ];
                }
            } catch (err) {
                finalContent = [
                    {
                        type: "text",
                        text: editingContent.trim(),
                    },
                ];
            }

            try {
                // Use updateMessage mutation with all required parameters
                await updateMessage.mutateAsync({
                    messageId,
                    threadId,
                    content: finalContent,
                    publisher: "user"
                });

                // Clear editing state
                setEditingMessage(null);
                setEditingContent("");
            } catch (err) {
                console.error("[confirmEditingMessage] error =>", err);
                toast({
                    title: "Error",
                    description: err instanceof Error ? err.message : "Failed to update message",
                    variant: "destructive"
                });
            }
        },
        [editingContent, setEditingContent, setEditingMessage, updateMessage, toast]
    );

    // Cancel editing a message
    const cancelEditingMessage = useCallback(() => {
        setThreads((prev: any) =>
            prev.map((thread: any) => {
                const removeEmptyMessage = (messages: Message[]): Message[] => {
                    if (!messages) return [];
                    return messages.reduce((acc: Message[], message) => {
                        if (message.id === editingMessage && (typeof message.content === "string"
                            ? !message.content.trim()
                            : (Array.isArray(message.content) && message.content.length === 0))) {
                            // If message is empty
                            deleteMessage.mutate({
                                messageId: message.id,
                                threadId: thread.id,
                                deleteOption: false
                            });
                            return acc;
                        }
                        return [...acc, { ...message, replies: removeEmptyMessage(message.replies) }];
                    }, []);
                };
                return { ...thread, messages: removeEmptyMessage(thread.messages) };
            })
        );
        setEditingMessage(null);
        setEditingContent("");
    }, [
        editingMessage,
        deleteMessage,
        setEditingContent,
        setEditingMessage,
        setThreads,
    ]);

    // Update message content
    const updateMessageContent = useCallback(
        (threadId: string, messageId: string, newContent: string | ContentPart[]) => {
            setThreads((prev: any) =>
                prev.map((thread: any) => {
                    if (thread.id !== threadId) return thread;
                    const updateContent = (messages: Message[]): Message[] => {
                        return messages.map((message) => {
                            if (message.id === messageId) {
                                if (typeof newContent === "string") {
                                    // Update with string content
                                    return { ...message, content: newContent };
                                } else {
                                    // Update with ContentPart[] content
                                    return { ...message, content: newContent };
                                }
                            }
                            return { ...message, replies: updateContent(message.replies) };
                        });
                    };
                    return { ...thread, messages: updateContent(thread.messages) };
                })
            );
        },
        [setThreads]
    );

    return {
        extractTextFromContent,
        startEditingMessage,
        confirmEditingMessage,
        cancelEditingMessage,
        updateMessageContent
    };
} 