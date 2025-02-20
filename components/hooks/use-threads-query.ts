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
        onMutate: async ({ threadId, updates }) => {
            await queryClient.cancelQueries({ queryKey: ['threads'] });
            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);

            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [];
                return old.map(thread => {
                    if (thread.id === threadId) {
                        return { ...thread, ...updates };
                    }
                    return thread;
                });
            });

            return { previousThreads };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['threads'], context?.previousThreads);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    const togglePin = useMutation({
        mutationFn: async (threadId: string) => {
            const threads = queryClient.getQueryData<Thread[]>(['threads']) || [];
            const thread = threads.find(t => t.id === threadId);
            if (!thread) throw new Error('Thread not found');
           
            const newPinnedState = thread.isPinned;
          

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

            const data = await response.json();
            if (!data.ok) {
                throw new Error('Server returned error');
            }

            return { threadId, isPinned: data.pinned };
        },
        onMutate: async (threadId) => {
            await queryClient.cancelQueries({ queryKey: ['threads'] });
            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);

            // Get the current thread state before updating
            const threads = previousThreads || [];
            const thread = threads.find(t => t.id === threadId);
            if (!thread) return { previousThreads };

            const newPinnedState = !thread.isPinned;

            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [];
                return old.map(thread => {
                    if (thread.id === threadId) {
                        return { ...thread, isPinned: newPinnedState };
                    }
                    return thread;
                });
            });

            return { previousThreads };
        },
        onError: (err, threadId, context) => {
            console.error('Error toggling pin:', err);
            if (context?.previousThreads) {
                queryClient.setQueryData(['threads'], context.previousThreads);
            }
        },
        onSettled: (data) => {
            if (data) {
                // Update with the server state
                queryClient.setQueryData<Thread[]>(['threads'], old => {
                    if (!old) return [];
                    return old.map(thread => {
                        if (thread.id === data.threadId) {
                            return { ...thread, isPinned: data.isPinned };
                        }
                        return thread;
                    });
                });
            }
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    const deleteThread = useMutation({
        mutationFn: async (threadId: string) => {
            const response = await fetch(`/api/threads/${threadId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete thread');
            }
            return response.json();
        },
        onMutate: async (threadId) => {
            await queryClient.cancelQueries({ queryKey: ['threads'] });
            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);

            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [];
                return old.filter(thread => thread.id !== threadId);
            });

            return { previousThreads };
        },
        onError: (err, threadId, context) => {
            queryClient.setQueryData(['threads'], context?.previousThreads);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['threads'] });
        },
    });

    const addThread = useMutation({
        mutationFn: async (thread: Partial<Thread>) => {
            const tempId = thread.id || `temp-${Date.now()}`;
            const response = await fetch('/api/threads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: tempId,
                    title: thread.title || "Unnamed Thread"
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to create thread');
            }

            // Fetch initial messages for the new thread
            const messagesResponse = await fetch(`/api/messages?threadId=${tempId}`);
            if (!messagesResponse.ok) {
                console.warn('Failed to fetch initial messages for new thread');
            }
            const messagesData = await messagesResponse.json();

            const data = await response.json();
            return {
                ...data,
                thread: {
                    ...data.thread,
                    messages: messagesData?.messages || []
                }
            };
        },
        onMutate: async (newThread) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['threads'] });
            await queryClient.cancelQueries({ queryKey: ['messages', newThread.id] });

            const previousThreads = queryClient.getQueryData<Thread[]>(['threads']);

            const tempThread = {
                ...newThread,
                id: newThread.id || `temp-${Date.now()}`,
                title: newThread.title || "Unnamed Thread",
                isPinned: false,
                role: "OWNER",
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            } as Thread;

            // Update threads cache
            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [tempThread];
                return [...old, tempThread];
            });

            // Initialize messages cache for the new thread
            queryClient.setQueryData(['messages', tempThread.id], []);

            return { previousThreads, tempThread };
        },
        onSuccess: (data, variables, context) => {
            if (!context) return;

            // Update threads cache with server response
            queryClient.setQueryData<Thread[]>(['threads'], old => {
                if (!old) return [data.thread];
                return old.map(thread =>
                    thread.id === context.tempThread.id ? data.thread : thread
                );
            });

            // Initialize messages cache for the new thread with server data
            if (data.thread.messages) {
                queryClient.setQueryData(['messages', data.thread.id], data.thread.messages);
            }

            // Force a refetch of messages for the new thread
            queryClient.invalidateQueries({
                queryKey: ['messages', data.thread.id],
                exact: true,
                refetchType: 'all'
            });
        },
        onSettled: (data) => {
            // Invalidate and refetch both queries
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            if (data?.thread.id) {
                queryClient.invalidateQueries({
                    queryKey: ['messages', data.thread.id],
                    exact: true,
                    refetchType: 'all'
                });
            }
        },
    });

    return {
        ...query,
        updateThread,
        togglePin,
        deleteThread,
        addThread,
    };
} 