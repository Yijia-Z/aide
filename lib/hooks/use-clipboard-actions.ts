import { useCallback } from 'react';
import { Message, Thread } from '@/components/types';
import { useToast } from './use-toast';
import { useMessagesMutation } from './use-messages-mutation';

interface UseClipboardActionsProps {
    clipboardMessage: any;
    setClipboardMessage: (value: any) => void;
    clearGlowingMessages: () => void;
    addGlowingMessage: (messageId: string) => void;
    findMessageById: (messages: Message[], id: string) => Message | null;
    threads: Thread[];
}

export function useClipboardActions({
    clipboardMessage,
    setClipboardMessage,
    clearGlowingMessages,
    addGlowingMessage,
    findMessageById,
    threads
}: UseClipboardActionsProps) {
    const { toast } = useToast();
    const { copyMessage, pasteMessage, addMessage } = useMessagesMutation();

    const isDescendant = useCallback((message: Message, targetId: string | null): boolean => {
        if (!targetId) return false;

        for (const reply of message.replies) {
            if (reply.id === targetId || isDescendant(reply, targetId)) {
                return true;
            }
        }

        return false;
    }, []);

    // Add copy/cut function
    const copyOrCutMessage = useCallback(
        async (threadId: string, messageId: string, operation: "copy" | "cut") => {
            try {
                const result = await copyMessage.mutateAsync({ threadId, messageId, operation });

                // Update clipboard state
                setClipboardMessage({
                    message: result.message,
                    operation,
                    sourceThreadId: threadId,
                    originalMessageId: messageId,
                });

                clearGlowingMessages();
                addGlowingMessage(messageId);
            } catch (error) {
                console.error("Failed to copy/cut message:", error);
                toast({
                    title: "Error",
                    description: "Failed to copy/cut message",
                    variant: "destructive"
                });
            }
        },
        [copyMessage, setClipboardMessage, clearGlowingMessages, addGlowingMessage, toast]
    );

    const handlePasteMessage = useCallback(
        async (threadId: string, parentId: string | null) => {
            if (!clipboardMessage) {
                // Handle pasting from system clipboard
                try {
                    const text = await navigator.clipboard.readText();
                    await addMessage.mutateAsync({
                        threadId,
                        parentId,
                        publisher: "user",
                        content: text
                    });
                } catch (error) {
                    console.error("Failed to paste from clipboard:", error);
                    toast({
                        title: "Error",
                        description: "Failed to paste from clipboard",
                        variant: "destructive"
                    });
                }
                return;
            }

            try {
                // Prevent pasting on the original message or its children
                if (clipboardMessage.operation === "cut" && clipboardMessage.originalMessageId) {
                    const originalMessage = findMessageById(
                        threads.find(t => t.id === clipboardMessage.sourceThreadId)?.messages || [],
                        clipboardMessage.originalMessageId
                    );

                    // Check if parentId matches original message or any of its descendants
                    if (originalMessage && (parentId === clipboardMessage.originalMessageId || isDescendant(originalMessage, parentId))) {
                        toast({
                            title: "Cannot paste here",
                            description: "Cannot paste a cut message onto itself or its descendants",
                            variant: "destructive"
                        });
                        return;
                    }
                }

                // Use pasteMessage mutation
                await pasteMessage.mutateAsync({
                    threadId,
                    parentId,
                    clipboardMessage
                });

                clearGlowingMessages();
            } catch (error) {
                console.error("Failed to paste message:", error);
                toast({
                    title: "Error",
                    description: "Failed to paste message",
                    variant: "destructive"
                });
            }
        },
        [clipboardMessage, addMessage, pasteMessage, setClipboardMessage, clearGlowingMessages, findMessageById, isDescendant, threads, toast]
    );

    // Helper function to check if a message is a descendant of another
    return {
        copyOrCutMessage,
        handlePasteMessage
    };
} 