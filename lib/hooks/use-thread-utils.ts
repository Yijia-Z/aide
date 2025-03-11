import { useCallback } from 'react';
import { Thread, Message } from '@/components/types';
import debounce from 'lodash.debounce';

interface UseThreadUtilsProps {
    setThreads: (value: Thread[] | ((prev: Thread[]) => Thread[])) => void;
    editingThreadTitle: string | null;
    originalThreadTitle: string;
    setEditingThreadTitle: (value: string | null) => void;
    setOriginalThreadTitle: (value: string) => void;
}

export function useThreadUtils({
    setThreads,
    editingThreadTitle,
    originalThreadTitle,
    setEditingThreadTitle,
    setOriginalThreadTitle
}: UseThreadUtilsProps) {
    // Find a message and its parents
    const findMessageAndParents = useCallback(
        (
            messages: Message[],
            targetId: string,
            parents: Message[] = []
        ): [Message | null, Message[]] => {
            for (const message of messages) {
                if (message.id === targetId) {
                    return [message, parents];
                }
                const [found, foundParents] = findMessageAndParents(
                    message.replies,
                    targetId,
                    [...parents, message]
                );
                if (found) {
                    return [found, foundParents];
                }
            }
            return [null, []];
        },
        []
    );

    // Get siblings of a message
    const getSiblings = useCallback(
        (messages: Message[], messageId: string): Message[] => {
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
        },
        []
    );

    // Start editing a thread title
    const startEditingThreadTitle = useCallback(
        (threadId: string, currentTitle: string) => {
            setEditingThreadTitle(threadId);
            setOriginalThreadTitle(currentTitle);
        },
        [setEditingThreadTitle, setOriginalThreadTitle]
    );

    // Save thread to backend
    const SaveThreadToBackend = useCallback(async (threadId: string, updatedData: Partial<Thread>) => {
        console.log("Front-end: calling fetch PATCH /api/threads/[id]", { threadId, updatedData });
        try {
            const res = await fetch(`/api/threads/${threadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData),
            });
            console.log("Front-end: response status:", res.status);
            if (!res.ok) {
                throw new Error(`Failed to update thread ${threadId}`);
            }
            const data = await res.json();
            console.log("Front-end: success, server returned data:", data);
            return data.thread;
        } catch (error) {
            console.error("Front-end: error in SaveThreadToBackend:", error);
            throw error;
        }
    }, []);

    const debouncedSaveThreadToBackend = debounce(
        async (threadId: string, updatedData: Partial<Thread>) => {
            await SaveThreadToBackend(threadId, updatedData);
        },
        2000 // 2 seconds
    );

    // Confirm editing a thread title
    const confirmEditThreadTitle = useCallback(
        (threadId: string, newTitle: string) => {
            setThreads((prev: Thread[]) =>
                prev.map((thread) =>
                    thread.id === threadId ? { ...thread, title: newTitle } : thread
                )
            );
            setEditingThreadTitle(null);
            setOriginalThreadTitle(newTitle);
            console.log("Attempting to save thread to backend:", {
                threadId,
                newTitle,
            });

            debouncedSaveThreadToBackend(threadId, { title: newTitle });
        },
        [
            debouncedSaveThreadToBackend,
            setEditingThreadTitle,
            setOriginalThreadTitle,
            setThreads,
        ]
    );

    // Cancel editing a thread title
    const cancelEditThreadTitle = useCallback(() => {
        setThreads((prev: Thread[]) =>
            prev.map((thread) =>
                thread.id === editingThreadTitle
                    ? { ...thread, title: originalThreadTitle }
                    : thread
            )
        );
        setEditingThreadTitle(null);
    }, [
        editingThreadTitle,
        originalThreadTitle,
        setEditingThreadTitle,
        setThreads,
    ]);

    // Toggle message collapse state
    const toggleCollapse = useCallback(
        (threadId: string, messageId: string) => {
            setThreads((prev: Thread[]) =>
                prev.map((thread) => {
                    if (thread.id !== threadId) return thread;
                    const toggleMessage = (messages: Message[]): Message[] => {
                        return messages.map((message) => {
                            if (message.id === messageId) {
                                return {
                                    ...message,
                                    isCollapsed: !message.isCollapsed,
                                    userCollapsed: !message.isCollapsed,
                                };
                            }
                            return { ...message, replies: toggleMessage(message.replies) };
                        });
                    };
                    return { ...thread, messages: toggleMessage(thread.messages) };
                })
            );
        },
        [setThreads]
    );

    // Find message by ID
    const findMessageById = useCallback(
        (messages: Message[], id: string): Message | null => {
            for (const message of messages) {
                if (message.id === id) return message;
                const found = findMessageById(message.replies, id);
                if (found) return found;
            }
            return null;
        },
        []
    );

    // Collapse deep children
    const collapseDeepChildren = useCallback(
        (
            msg: Message,
            selectedDepth: number,
            currentDepth: number,
            isSelectedBranch: boolean
        ): Message => {
            const maxDepth =
                window.innerWidth >= 1024
                    ? 8
                    : window.innerWidth >= 768
                        ? 7
                        : window.innerWidth >= 480
                            ? 6
                            : 5;

            const shouldAutoCollapse = isSelectedBranch
                ? currentDepth - selectedDepth >= maxDepth
                : currentDepth >= maxDepth;

            return {
                ...msg,
                isCollapsed: msg.userCollapsed || shouldAutoCollapse,
                replies: msg.replies.map((reply) =>
                    collapseDeepChildren(
                        reply,
                        selectedDepth,
                        currentDepth + 1,
                        isSelectedBranch
                    )
                ),
            };
        },
        []
    );

    return {
        findMessageAndParents,
        getSiblings,
        startEditingThreadTitle,
        SaveThreadToBackend,
        debouncedSaveThreadToBackend,
        confirmEditThreadTitle,
        cancelEditThreadTitle,
        toggleCollapse,
        findMessageById,
        collapseDeepChildren
    };
} 