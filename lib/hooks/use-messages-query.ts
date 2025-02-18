import { useQuery } from '@tanstack/react-query';
import { Message, Thread } from '@/components/types';

interface UseMessagesQueryProps {
    threadId: string | null;
    enabled?: boolean;
}

interface MessagesResponse {
    messages: Message[];
}

export const useMessagesQuery = ({ threadId, enabled = true }: UseMessagesQueryProps) => {
    return useQuery({
        queryKey: ['messages', threadId],
        queryFn: async (): Promise<Message[]> => {
            if (!threadId) {
                return [];
            }

            console.log('Fetching messages for thread:', threadId);
            const response = await fetch(`/api/messages?threadId=${threadId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }
            const data: MessagesResponse = await response.json();
            console.log('Received messages:', data.messages);

            // Initialize collapse states for messages and handle potential null/undefined
            function initCollapse(messages: Message[] | null | undefined): Message[] {
                if (!messages || !Array.isArray(messages)) {
                    return [];
                }
                return messages.map(msg => ({
                    ...msg,
                    isCollapsed: false,
                    userCollapsed: false,
                    content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content as string }],
                    replies: initCollapse(msg.replies)
                }));
            }

            const initializedMessages = initCollapse(data.messages);
            return initializedMessages;
        },
        enabled: !!threadId && enabled,
        staleTime: 0, // Always fetch fresh data
        gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
        refetchOnMount: "always", // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnReconnect: true, // Refetch when reconnecting
        retry: 3, // Retry failed requests 3 times
        retryDelay: 1000, // Wait 1 second between retries
    });
}; 