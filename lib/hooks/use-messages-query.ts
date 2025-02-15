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

            const response = await fetch(`/api/messages?threadId=${threadId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }
            const data: MessagesResponse = await response.json();

            // Initialize collapse states for messages
            function initCollapse(messages: Message[]): Message[] {
                return messages.map(msg => ({
                    ...msg,
                    isCollapsed: false,
                    userCollapsed: false,
                    replies: Array.isArray(msg.replies) ? initCollapse(msg.replies) : []
                }));
            }

            return initCollapse(data.messages || []);
        },
        enabled: !!threadId && enabled,
        staleTime: 1000 * 60, // Consider data fresh for 1 minute
        gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
    });
}; 