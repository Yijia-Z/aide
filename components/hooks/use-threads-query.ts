import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Thread } from '@/components/types';

export function useThreadsQuery() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['threads'],
        queryFn: async (): Promise<Thread[]> => {
            const response = await fetch('/api/threads');
            if (!response.ok) {
                throw new Error('Failed to fetch threads');
            }
            const data = await response.json();
            return data.threads;
        },
        staleTime: 1000 * 60, // Consider data fresh for 1 minute
        gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
    });

    const updateThread = useMutation({
        mutationFn: async ({ threadId, updates }: { threadId: string; updates: Partial<Thread> }) => {
            const response = await fetch(`/api/threads/${threadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                throw new Error('Failed to update thread');
            }
            return response.json();
        },
        onSuccess: () => {
            // Invalidate and refetch threads after a successful update
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    const togglePin = useMutation({
        mutationFn: async (threadId: string) => {
            // Get the current thread state
            const threads = queryClient.getQueryData<Thread[]>(['threads']) || [];
            const thread = threads.find(t => t.id === threadId);
            const newPinnedState = !(thread?.isPinned);

            const response = await fetch("/api/membership/insertpin", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    threadId,
                    pinned: newPinnedState,
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to toggle pin state');
            }
            return response.json();
        },
        onMutate: async (threadId) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['threads'] });

            // Snapshot the previous value
            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);

            // Optimistically update to the new value
            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [];
                return old.map(thread => {
                    if (thread.id === threadId) {
                        return { ...thread, isPinned: !thread.isPinned };
                    }
                    return thread;
                });
            });

            // Return a context object with the snapshotted value
            return { previousThreads };
        },
        onError: (err, threadId, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            queryClient.setQueryData(['threads'], context?.previousThreads);
        },
        onSettled: () => {
            // Always refetch after error or success to ensure data is in sync
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    return {
        ...query,
        updateThread,
        togglePin,
    };
} 