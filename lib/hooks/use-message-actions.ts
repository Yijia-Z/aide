import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '@/components/types';
import { useToast } from './use-toast';
import { useMessagesMutation } from './use-messages-mutation';

interface UseMessageActionsProps {
    startEditingMessage: (message: Message) => void;
}

export function useMessageActions({
    startEditingMessage
}: UseMessageActionsProps) {
    const { toast } = useToast();
    const { addMessage, deleteMessage } = useMessagesMutation();

    // Add a new message
    const addEmptyReply = useCallback(
        async (threadId: string, parentId: string | null, publisher: "user" | "ai" = "user") => {
            const newId = uuidv4();

            try {
                // First create the message in the database
                await addMessage.mutateAsync({
                    id: newId,
                    threadId,
                    parentId,
                    publisher,
                    content: "",
                });

                // Then start editing it
                startEditingMessage({
                    id: newId,
                    content: "",
                    publisher,
                    replies: [],
                    isCollapsed: false,
                    userCollapsed: false,
                });

                // Scroll to the new message
                const newMessageElement = document.getElementById(
                    `message-${newId}`
                );
                if (newMessageElement) {
                    newMessageElement.scrollIntoView({
                        behavior: "smooth",
                        block: "end",
                    });
                }
            } catch (err) {
                console.error("[addEmptyReply] error =>", err);
                toast({
                    title: "Error",
                    description: err instanceof Error ? err.message : "Failed to add message",
                    variant: "destructive"
                });
            }
        },
        [addMessage, startEditingMessage, toast]
    );

    // Delete a message
    const handleDeleteMessage = useCallback(
        async (threadId: string, messageId: string, deleteOption: boolean | 'clear') => {
            try {
                await deleteMessage.mutateAsync({
                    messageId,
                    threadId,
                    deleteOption
                });
            } catch (err) {
                console.error("[deleteMessage] error =>", err);
                toast({
                    title: "Error",
                    description: err instanceof Error ? err.message : "Failed to delete message",
                    variant: "destructive"
                });
            }
        },
        [deleteMessage, toast]
    );

    return {
        addEmptyReply,
        handleDeleteMessage
    };
} 